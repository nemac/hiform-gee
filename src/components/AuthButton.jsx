import { Button } from "@mui/material";

const AuthButton = (props) => {
  const { setIsAuthenticated } = props;
  const handleAuth = () => {
    const CLIENT_ID =
      "69422135114-clt6gum3gcl1utj8qtaet02vsqpmt1th.apps.googleusercontent.com";

    ee.data.authenticateViaOauth(
      CLIENT_ID,
      () => {
        ee.initialize(
          null,
          null,
          () => setIsAuthenticated(true),
          (error) => console.error("Init error:", error),
        );
      },
      (error) => console.error("Auth error:", error),
      null,
      () => ee.data.authenticateViaPopup(() => setIsAuthenticated(true)),
    );
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Button
        variant="contained"
        onClick={handleAuth}
        style={{ textTransform: "none" }}
      >
        Sign in with Google
      </Button>
    </div>
  );
};

export default AuthButton;
