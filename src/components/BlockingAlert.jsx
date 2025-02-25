import { Backdrop, Paper, Typography, Button, Box } from "@mui/material";

const BlockingAlert = ({ alert, onClose }) => {
  if (!alert.status) return null;

  return (
    <Backdrop
      sx={{
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      open={alert.status}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          maxWidth: "500px",
          width: "90%",
          textAlign: "center",
        }}
      >
        <Typography
          variant="h6"
          color={
            alert.severity === "error"
              ? "error"
              : alert.severity === "warning"
                ? "warning.main"
                : alert.severity === "success"
                  ? "success.main"
                  : "primary"
          }
          gutterBottom
        >
          {alert.severity === "error"
            ? "Error"
            : alert.severity === "warning"
              ? "Warning"
              : alert.severity === "success"
                ? "Success"
                : "Information"}
        </Typography>

        <Typography variant="body1" paragraph>
          {alert.message}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={onClose} autoFocus>
            Acknowledge
          </Button>
        </Box>
      </Paper>
    </Backdrop>
  );
};

export default BlockingAlert;
