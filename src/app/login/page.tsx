const MSG: Record<string, string> = {
  not_allowed: "This email is not on the team list. Ask a partner to add it.",
  failed: "Sign-in did not finish. Please try again.",
  config: "Sign-in is not set up yet. Ask the person who runs the app to add the Google keys.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (<div className="mx-auto mt-16 max-w-sm text-center">
    <h1 className="text-2xl">All In Capital</h1><p className="mt-2 text-sm text-muted">Sign in with your fund Google account.</p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-[var(--red-tint)] p-3 text-sm text-red">{MSG[error] ?? MSG.failed}</p>}
    <a href="/api/auth/google" className="btn mt-6 inline-flex items-center justify-center bg-cobalt text-[var(--on-cobalt)] hover:bg-[var(--cobalt-hover)]">Sign in with Google</a></div>);
}
