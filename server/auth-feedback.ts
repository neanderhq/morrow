export const INVALID_LOGIN_MESSAGE = "Incorrect email or password.";

export function invalidLoginResponse() {
  return Response.json({ message: INVALID_LOGIN_MESSAGE }, { status: 401 });
}
