import { AuthFlow } from "./auth-flow";
export function SignUpForm({ nextPath = "/market" }: { nextPath?: string }) {
  return <AuthFlow mode="signup" nextPath={nextPath} />;
}
