//! Windows owns the whole child tree from the instant it is created. In particular,
//! assigning a job *after* spawn is too late for the Python venv redirector.
use std::ffi::OsStr;
use std::fs::{File, OpenOptions};
use std::io;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::path::Path;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
use windows_sys::Win32::System::JobObjects::*;
use windows_sys::Win32::System::Pipes::CreatePipe;
use windows_sys::Win32::System::Threading::*;

pub struct OwnedProcess {
    job: OwnedHandle,
    process: OwnedHandle,
    input: Option<File>,
}

fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}

// CommandLineToArgvW / MS C runtime quoting, including trailing backslashes.
fn quote(value: &OsStr) -> Vec<u16> {
    let mut result = vec![b'"' as u16];
    let mut slashes = 0;
    for ch in value.encode_wide() {
        if ch == b'\\' as u16 {
            slashes += 1;
        } else {
            result.extend(std::iter::repeat_n(
                b'\\' as u16,
                slashes * if ch == b'"' as u16 { 2 } else { 1 },
            ));
            slashes = 0;
            if ch == b'"' as u16 {
                result.push(b'\\' as u16);
            }
            result.push(ch);
        }
    }
    result.extend(std::iter::repeat_n(b'\\' as u16, slashes * 2));
    result.push(b'"' as u16);
    result
}

fn checked(ok: i32) -> io::Result<()> {
    if ok == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

struct Attributes {
    storage: Vec<usize>,
}

impl Attributes {
    fn new() -> io::Result<Self> {
        unsafe {
            let mut bytes = 0;
            InitializeProcThreadAttributeList(null_mut(), 2, 0, &mut bytes);
            let mut storage = vec![0usize; bytes.div_ceil(size_of::<usize>())];
            checked(InitializeProcThreadAttributeList(
                storage.as_mut_ptr().cast(),
                2,
                0,
                &mut bytes,
            ))?;
            Ok(Self { storage })
        }
    }

    fn ptr(&mut self) -> LPPROC_THREAD_ATTRIBUTE_LIST {
        self.storage.as_mut_ptr().cast()
    }
}

impl Drop for Attributes {
    fn drop(&mut self) {
        unsafe { DeleteProcThreadAttributeList(self.ptr()) }
    }
}

impl OwnedProcess {
    pub fn spawn(executable: &Path, args: &[&OsStr], cwd: &Path, log: &Path) -> io::Result<Self> {
        // No shell or uv runner. All handles are RAII-owned, including error paths.
        unsafe {
            let raw_job = CreateJobObjectW(null(), null());
            if raw_job.is_null() {
                return Err(io::Error::last_os_error());
            }
            let job = OwnedHandle::from_raw_handle(raw_job);
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            checked(SetInformationJobObject(
                raw_job,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                size_of_val(&limits) as u32,
            ))?;

            let security = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: null_mut(),
                bInheritHandle: 1,
            };
            let (mut read, mut write) = (null_mut(), null_mut());
            checked(CreatePipe(&mut read, &mut write, &security, 0))?;
            let read = OwnedHandle::from_raw_handle(read);
            let input = File::from_raw_handle(write);
            checked(SetHandleInformation(
                input.as_raw_handle(),
                HANDLE_FLAG_INHERIT,
                0,
            ))?;
            let output = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(log)?;
            checked(SetHandleInformation(
                output.as_raw_handle(),
                HANDLE_FLAG_INHERIT,
                HANDLE_FLAG_INHERIT,
            ))?;

            let mut attributes = Attributes::new()?;
            let handles = [read.as_raw_handle(), output.as_raw_handle()];
            checked(UpdateProcThreadAttribute(
                attributes.ptr(),
                0,
                PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                handles.as_ptr().cast(),
                size_of_val(&handles),
                null_mut(),
                null(),
            ))?;
            let jobs = [raw_job];
            checked(UpdateProcThreadAttribute(
                attributes.ptr(),
                0,
                PROC_THREAD_ATTRIBUTE_JOB_LIST as usize,
                jobs.as_ptr().cast(),
                size_of_val(&jobs),
                null_mut(),
                null(),
            ))?;
            let mut startup: STARTUPINFOEXW = zeroed();
            startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
            startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
            startup.StartupInfo.hStdInput = read.as_raw_handle();
            startup.StartupInfo.hStdOutput = output.as_raw_handle();
            startup.StartupInfo.hStdError = output.as_raw_handle();
            startup.lpAttributeList = attributes.ptr();
            let mut command = quote(executable.as_os_str());
            for arg in args {
                command.push(b' ' as u16);
                command.extend(quote(arg));
            }
            command.push(0);
            let mut process: PROCESS_INFORMATION = zeroed();
            checked(CreateProcessW(
                wide(executable.as_os_str()).as_ptr(),
                command.as_mut_ptr(),
                null(),
                null(),
                1,
                CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT,
                null(),
                wide(cwd.as_os_str()).as_ptr(),
                &startup.StartupInfo,
                &mut process,
            ))?;
            let _thread = OwnedHandle::from_raw_handle(process.hThread);
            Ok(Self {
                job,
                process: OwnedHandle::from_raw_handle(process.hProcess),
                input: Some(input),
            })
        }
    }

    pub fn running(&self) -> bool {
        unsafe { WaitForSingleObject(self.process.as_raw_handle(), 0) == WAIT_TIMEOUT }
    }

    #[cfg(test)]
    pub fn id(&self) -> u32 {
        unsafe { GetProcessId(self.process.as_raw_handle()) }
    }

    fn active_processes(&self) -> io::Result<u32> {
        unsafe {
            let mut info: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = zeroed();
            checked(QueryInformationJobObject(
                self.job.as_raw_handle(),
                JobObjectBasicAccountingInformation,
                (&mut info as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                size_of_val(&info) as u32,
                null_mut(),
            ))?;
            Ok(info.ActiveProcesses)
        }
    }

    pub fn stop(&mut self) {
        // EOF asks the Python wrapper to shut down normally. Bound the grace period
        // even if startup/network IO or an active request is stuck, then kill the job.
        if self.input.take().is_some() {
            unsafe {
                WaitForSingleObject(self.process.as_raw_handle(), 1500);
                TerminateJobObject(self.job.as_raw_handle(), 1);
                WaitForSingleObject(self.process.as_raw_handle(), 1500);
            }
            let start = std::time::Instant::now();
            while self.active_processes().is_ok_and(|count| count > 0)
                && start.elapsed() < std::time::Duration::from_millis(1500)
            {
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
        }
    }
}

impl Drop for OwnedProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    const TREE: &str = "import os, sys, subprocess, json\nchild = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])\nprint(json.dumps([os.getpid(), child.pid]), flush=True)\nsys.stdin.readline()\n";

    fn paths(name: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let repo = std::env::var_os("LOLMIX_REPO")
            .map(PathBuf::from)
            .unwrap_or_else(|| manifest.join("../../../../lolmix"));
        let folder = manifest.join("target/lifecycle-tests");
        std::fs::create_dir_all(&folder).unwrap();
        (
            repo,
            folder.join(format!("{name}-{}.log", std::process::id())),
        )
    }
    use std::path::PathBuf;

    fn spawn_tree(repo: &Path, log: &Path) -> OwnedProcess {
        OwnedProcess::spawn(
            &repo.join(".venv/Scripts/python.exe"),
            &[OsStr::new("-u"), OsStr::new("-c"), OsStr::new(TREE)],
            repo,
            log,
        )
        .unwrap()
    }

    fn wait_pids(log: &Path) -> Vec<OwnedHandle> {
        let start = Instant::now();
        loop {
            if let Ok(text) = std::fs::read_to_string(log) {
                if let Ok(pids) = serde_json::from_str::<Vec<u32>>(text.trim()) {
                    return pids
                        .into_iter()
                        .map(|pid| unsafe {
                            let handle = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
                            assert!(!handle.is_null(), "could not open test process {pid}");
                            OwnedHandle::from_raw_handle(handle)
                        })
                        .collect();
                }
            }
            assert!(
                start.elapsed() < Duration::from_secs(10),
                "test tree did not start: {}",
                log.display()
            );
            std::thread::sleep(Duration::from_millis(30));
        }
    }

    #[test]
    fn shutdown_kills_grandchildren_even_after_parent_exits() {
        let (repo, log) = paths("tree");
        let mut process = spawn_tree(&repo, &log);
        let descendants = wait_pids(&log);
        assert!(process.active_processes().unwrap() >= 2);
        process.stop();
        process.stop();
        assert_eq!(process.active_processes().unwrap(), 0);
        for handle in descendants {
            assert_eq!(
                unsafe { WaitForSingleObject(handle.as_raw_handle(), 1000) },
                WAIT_OBJECT_0
            );
        }
    }

    #[test]
    fn abrupt_parent_helper() {
        let Some(log) = std::env::var_os("DRAFTGAP_TEST_JOB_LOG") else {
            return;
        };
        let (repo, _) = paths("helper");
        let _process = spawn_tree(&repo, Path::new(&log));
        std::thread::sleep(Duration::from_secs(60));
    }

    #[test]
    fn killing_supervisor_closes_job_and_kills_entire_tree() {
        let (_, log) = paths("crash");
        let mut supervisor = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "owned_process::tests::abrupt_parent_helper",
                "--nocapture",
            ])
            .env("DRAFTGAP_TEST_JOB_LOG", &log)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .unwrap();
        let descendants = wait_pids(&log);
        supervisor.kill().unwrap();
        supervisor.wait().unwrap();
        for handle in descendants {
            assert_eq!(
                unsafe { WaitForSingleObject(handle.as_raw_handle(), 5000) },
                WAIT_OBJECT_0
            );
        }
    }

    #[test]
    fn arguments_preserve_quotes_unicode_spaces_and_trailing_backslashes() {
        let (repo, log) = paths("quoting");
        let args = [
            "",
            "two words",
            "quoted \"value\"",
            "C:\\space path\\",
            "雪",
        ];
        let mut command = vec![
            OsStr::new("-u"),
            OsStr::new("-c"),
            OsStr::new("import json, sys; print(json.dumps(sys.argv[1:]), flush=True)"),
        ];
        command.extend(args.iter().map(OsStr::new));
        let mut process = OwnedProcess::spawn(
            &repo.join(".venv/Scripts/python.exe"),
            &command,
            &repo,
            &log,
        )
        .unwrap();
        assert_eq!(
            unsafe { WaitForSingleObject(process.process.as_raw_handle(), 5000) },
            WAIT_OBJECT_0
        );
        let actual: Vec<String> =
            serde_json::from_str(&std::fs::read_to_string(log).unwrap()).unwrap();
        assert_eq!(actual, args);
        process.stop();
    }
}
