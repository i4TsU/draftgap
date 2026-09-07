export function ratingToWinrate(d: number) {
    return 1 / (1 + Math.pow(10, -d / 400));
}

// Get rating difference from winrate
export function winrateToRating(w: number) {
    const bounded = Math.max(0.0001, Math.min(0.9999, w));
    return -400 * Math.log10(1 / bounded - 1);
}

// Get winrate for w1 against w2
export function getMatchupWinrate(w1: number, w2: number) {
    return ratingToWinrate(winrateToRating(w1) - winrateToRating(w2));
}

export function getDuoWinrate(w1: number, w2: number) {
    return ratingToWinrate(winrateToRating(w1) + winrateToRating(w2));
}
