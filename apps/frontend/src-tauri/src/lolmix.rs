#[cfg(windows)]
mod windows {
    use crate::owned_process::OwnedProcess;
    use reqwest::blocking::Client;
    use std::ffi::OsStr;
    use std::net::{SocketAddr, TcpStream};
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    const RUNNER: &str = include_str!("../../../../scripts/lib/lolmix-service.py");
    const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
    const POLL: Duration = Duration::from_millis(100);

    #[derive(Default)]
    struct State {
        owned: Option<OwnedProcess>,
        port: Option<u16>,
    }

    pub struct Service {
        state: Mutex<State>,
        stopping: AtomicBool,
        log: PathBuf,
        runner: String,
        startup_timeout: Duration,
    }

    fn is_repo(path: &Path) -> bool {
        path.join("lolmix/server.py").is_file() && path.join("pyproject.toml").is_file()
    }

    fn repository() -> Result<PathBuf, String> {
        if let Some(path) = std::env::var_os("LOLMIX_REPO") {
            let path = PathBuf::from(path);
            return if path.is_absolute() && is_repo(&path) {
                Ok(path)
            } else {
                Err("LOLMIX_REPO must point to an absolute LoLMix checkout path.".into())
            };
        }
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        // Supports a sibling checkout beside a moved EXE or anywhere above a
        // checkout build. The build-time sibling also supports a copied local EXE.
        let candidates = executable
            .parent()
            .into_iter()
            .flat_map(Path::ancestors)
            .map(|path| path.join("lolmix"))
            .chain([PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../../lolmix")]);
        candidates.into_iter().find(|path| is_repo(path)).ok_or_else(||
            "LoLMix was not found. Keep the lolmix checkout beside draftgap, or set LOLMIX_REPO to its absolute path.".into())
    }

    fn healthy(client: &Client, port: u16) -> bool {
        client
            .get(format!("http://127.0.0.1:{port}/health"))
            .send()
            .and_then(|r| r.error_for_status())
            .and_then(|r| r.json::<serde_json::Value>())
            .is_ok_and(|body| {
                body["app"] == "lolmix" && body["status"] == "ok" && body["schema_version"] == 1
            })
    }

    impl Service {
        pub fn new(log: PathBuf) -> Self {
            Self {
                state: Mutex::new(State::default()),
                stopping: AtomicBool::new(false),
                log,
                runner: RUNNER.to_owned(),
                startup_timeout: STARTUP_TIMEOUT,
            }
        }

        pub fn ensure(&self, host: &str, port: u16) -> Result<(), String> {
            // One lock covers health checks, startup, config changes and cleanup.
            // Concurrent WebView requests can never start competing children.
            let mut state = self
                .state
                .lock()
                .map_err(|_| "LoLMix supervisor lock failed")?;
            if self.stopping.load(Ordering::SeqCst) {
                return Err("DraftGap is closing.".into());
            }
            let local = matches!(host, "127.0.0.1" | "localhost");
            if !local || state.port.is_some_and(|current| current != port) {
                state.owned.take();
                state.port = None;
            }
            // Remote/custom hosts continue using the existing HTTP connection.
            if !local {
                return Ok(());
            }
            if port == 0 {
                return Err("LoLMix requires a port between 1 and 65535.".into());
            }
            let client = Client::builder()
                .no_proxy()
                .timeout(Duration::from_millis(600))
                .build()
                .map_err(|e| e.to_string())?;
            if state
                .owned
                .as_ref()
                .is_some_and(|process| !process.running())
            {
                state.owned.take();
                state.port = None;
            }
            if healthy(&client, port) {
                return Ok(());
            }
            // A live but unresponsive owned server must not be replaced by a second
            // server. Retry checks it again; app exit always tears down its job.
            if state.owned.is_some() {
                return Err("The managed LoLMix server is not responding. Retry the connection or reopen DraftGap.".into());
            }
            let address = SocketAddr::from(([127, 0, 0, 1], port));
            if TcpStream::connect_timeout(&address, Duration::from_millis(600)).is_ok() {
                return Err(format!("Port {port} is in use by a service that is not a compatible LoLMix server. Choose another port in Settings."));
            }
            let repo = repository()?;
            let python = repo.join(".venv/Scripts/python.exe");
            if !python.is_file() {
                return Err(format!("LoLMix's Python environment is missing in {}. Run bun run --bun setup:all once from the DraftGap checkout.", repo.display()));
            }
            if let Some(parent) = self.log.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Could not create LoLMix log directory: {e}"))?;
            }
            let port_arg = port.to_string();
            state.owned = Some(
                OwnedProcess::spawn(
                    &python,
                    &[
                        OsStr::new("-u"),
                        OsStr::new("-c"),
                        OsStr::new(&self.runner),
                        OsStr::new(&port_arg),
                    ],
                    &repo,
                    &self.log,
                )
                .map_err(|e| format!("Could not start LoLMix: {e}"))?,
            );
            state.port = Some(port);
            let start = Instant::now();
            let ready = format!("LoLMix listening on http://127.0.0.1:{port}");
            let error = loop {
                if self.stopping.load(Ordering::SeqCst) {
                    break "DraftGap is closing.";
                }
                if !state.owned.as_ref().unwrap().running() {
                    break "LoLMix exited during startup.";
                }
                // Readiness must come from OUR child after it binds successfully,
                // not another compatible server that won a race for this port.
                let bound = std::fs::read_to_string(&self.log)
                    .is_ok_and(|log| log.lines().any(|line| line == ready));
                if bound && healthy(&client, port) {
                    return Ok(());
                }
                if start.elapsed() >= self.startup_timeout {
                    break "LoLMix timed out during startup.";
                }
                std::thread::sleep(POLL);
            };
            state.owned.take();
            state.port = None;
            Err(format!(
                "{error} See {} for details, then Retry.",
                self.log.display()
            ))
        }

        pub fn stop(&self) {
            // Interrupt a concurrent startup before waiting for its lock.
            self.stopping.store(true, Ordering::SeqCst);
            let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
            state.owned.take();
            state.port = None;
        }
    }

    impl Drop for Service {
        fn drop(&mut self) {
            self.stop();
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::net::TcpListener;
        use std::sync::Arc;

        // Real HTTP handlers and process launcher, synthetic catalog: no network data.
        fn fixture(name: &str) -> (Service, u16) {
            let port = TcpListener::bind("127.0.0.1:0")
                .unwrap()
                .local_addr()
                .unwrap()
                .port();
            let log = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target/lifecycle-tests")
                .join(format!("{name}-{}-{port}.log", std::process::id()));
            let mut service = Service::new(log);
            service.runner = RUNNER.replace(
                "from lolmix import server",
                "from lolmix import server\nserver.Catalog = lambda: object()",
            );
            service.startup_timeout = Duration::from_secs(8);
            (service, port)
        }

        fn client() -> Client {
            Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(1))
                .build()
                .unwrap()
        }

        #[test]
        fn concurrent_requests_reuse_one_server_and_stop_is_idempotent() {
            let (service, port) = fixture("concurrent");
            let service = Arc::new(service);
            let threads: Vec<_> = (0..5)
                .map(|_| {
                    let service = service.clone();
                    std::thread::spawn(move || service.ensure("127.0.0.1", port))
                })
                .collect();
            for thread in threads {
                thread.join().unwrap().unwrap();
            }
            assert!(healthy(&client(), port));
            let before = service.state.lock().unwrap().owned.as_ref().unwrap().id();
            service.ensure("localhost", port).unwrap();
            assert_eq!(
                before,
                service.state.lock().unwrap().owned.as_ref().unwrap().id()
            );
            service.stop();
            service.stop();
            assert!(!healthy(&client(), port));
            assert!(service.ensure("127.0.0.1", port).is_err());
        }

        #[test]
        fn existing_server_is_reused_and_never_stopped_by_borrower() {
            let (owner, port) = fixture("owner");
            owner.ensure("127.0.0.1", port).unwrap();
            let (borrower, _) = fixture("borrower");
            borrower.ensure("127.0.0.1", port).unwrap();
            assert!(borrower.state.lock().unwrap().owned.is_none());
            borrower.stop();
            assert!(healthy(&client(), port));
            owner.stop();
            assert!(!healthy(&client(), port));
        }

        #[test]
        fn occupied_port_is_not_spawned_over() {
            let (service, _) = fixture("occupied");
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let port = listener.local_addr().unwrap().port();
            assert!(service
                .ensure("127.0.0.1", port)
                .unwrap_err()
                .contains("in use"));
            assert!(service.state.lock().unwrap().owned.is_none());
        }

        #[test]
        fn config_changes_stop_previous_owned_server() {
            let (service, first) = fixture("config");
            let (_, second) = fixture("second");
            service.ensure("127.0.0.1", first).unwrap();
            service.ensure("127.0.0.1", second).unwrap();
            assert!(!healthy(&client(), first));
            assert!(healthy(&client(), second));
            service.ensure("example.invalid", second).unwrap();
            assert!(!healthy(&client(), second));
            assert!(service.state.lock().unwrap().owned.is_none());
        }

        #[test]
        fn startup_failure_and_timeout_leave_no_owned_process() {
            for runner in [
                "raise RuntimeError('synthetic startup failure')",
                "import time; time.sleep(60)",
            ] {
                let (mut service, port) = fixture("failure");
                service.runner = runner.to_owned();
                service.startup_timeout = Duration::from_millis(300);
                assert!(service.ensure("127.0.0.1", port).is_err());
                assert!(service.state.lock().unwrap().owned.is_none());
                assert!(!healthy(&client(), port));
            }
        }

        #[test]
        fn close_during_startup_interrupts_wait_and_cleans_up() {
            let (mut service, port) = fixture("interrupted");
            service.runner = "import time; time.sleep(60)".to_owned();
            let service = Arc::new(service);
            let worker = service.clone();
            let thread = std::thread::spawn(move || worker.ensure("127.0.0.1", port));
            std::thread::sleep(Duration::from_millis(250));
            let start = Instant::now();
            service.stop();
            assert!(thread.join().unwrap().is_err());
            assert!(start.elapsed() < Duration::from_secs(5));
            assert!(service.state.lock().unwrap().owned.is_none());
        }
    }
}

#[cfg(windows)]
pub use windows::Service;

// Automatic management is currently a Windows desktop feature. Other platforms
// retain their manually configured service, with the same frontend command.
#[cfg(not(windows))]
pub struct Service;

#[cfg(not(windows))]
impl Service {
    pub fn new(_: std::path::PathBuf) -> Self {
        Self
    }
    pub fn ensure(&self, _: &str, _: u16) -> Result<(), String> {
        Ok(())
    }
    pub fn stop(&self) {}
}
