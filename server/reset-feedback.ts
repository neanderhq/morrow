export function resetCompletionFeedback(loggedOut: boolean) {
  return {
    confirmation: "Password updated. Sign in using your new password.",
    logoutWarning: loggedOut ? null : "Your password was updated, but your current session could not be ended. Sign out manually before signing in again.",
  };
}
