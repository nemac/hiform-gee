import { useState } from "react";
import {
  Box,
  TextField,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Button,
  Tabs,
  Tab,
} from "@mui/material";

const GoogleExport = (props) => {
  const {
    onFileNameChange,
    onFolderChange,
    onImageChange,
    onScaleChange,
    onCRSChange,
    onCancel,
    onDriveSubmit,
    onCloudSubmit,
    folder,
    fileName,
    scale,
    crs,
    images,
    selectedImage,
  } = props;
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const imageTypes = Object.keys(images);

  return (
    <Box sx={{ minWidth: 500 }}>
      <Typography variant="h5" gutterBottom>
        Task: Initiate image export
      </Typography>

      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Task Type</InputLabel>
          <Select
            variant="outlined"
            value={selectedImage}
            onChange={onImageChange}
            label="Selected Image"
          >
            {imageTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TextField
        fullWidth
        label="Coordinate Reference System (CRS)"
        value={crs}
        margin="normal"
        onChange={onCRSChange}
      />

      <TextField
        fullWidth
        label="Scale (m/px)"
        type="number"
        value={scale}
        margin="normal"
        onChange={onScaleChange}
      />

      <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 3, mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="DRIVE" />
          <Tab label="CLOUD STORAGE" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Box>
          <TextField
            fullWidth
            label="Drive folder"
            value={folder}
            placeholder="Drive folder name or blank for root"
            margin="normal"
            onChange={onFolderChange}
          />
          <TextField
            fullWidth
            required
            label="Filename"
            margin="normal"
            onChange={onFileNameChange}
            value={fileName}
          />
        </Box>
      )}

      {tabValue === 1 && (
        <Box>
          <TextField
            fullWidth
            label="Cloud Bucket"
            value={folder}
            placeholder="Cloud Bucket name or blank for root"
            margin="normal"
            onChange={onFolderChange}
          />
          <TextField
            fullWidth
            required
            label="Filename"
            margin="normal"
            onChange={onFileNameChange}
            value={fileName}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>File format</InputLabel>
            <Select defaultValue="GEO_TIFF" label="File format">
              <MenuItem value="GEO_TIFF">GEO_TIFF</MenuItem>
              <MenuItem value="PNG">PNG</MenuItem>
              <MenuItem value="JPEG">JPEG</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      <DialogActions sx={{ mt: 3 }}>
        <Button onClick={onCancel}>CANCEL</Button>
        <Button
          onClick={tabValue === 0 ? onDriveSubmit : onCloudSubmit}
          variant="contained"
          color="primary"
        >
          SUBMIT
        </Button>
      </DialogActions>
    </Box>
  );
};

export default GoogleExport;
