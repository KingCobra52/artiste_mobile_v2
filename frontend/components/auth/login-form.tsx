import { AuthFlow } from "./auth-flow";
export function LoginForm({ nextPath = "/market" }: { nextPath?: string }) {
  return <AuthFlow mode="login" nextPath={nextPath} />;
}
