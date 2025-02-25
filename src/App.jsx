import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Portal,
  Select,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import AuthButton from "./components/AuthButton.jsx";
import {
  cloudThresholds,
  satellites,
  sldIntervalsAbsoluteNdvi,
} from "./config.js";
import "leaflet/dist/leaflet.css";
import {
  NLCDDeciduousMask,
  NLCDEvergreenMask,
  NLCDForestMask,
  NLCDWaterMask,
} from "./masks.js";
import {
  addHillshade,
  generateDateTimeString,
  getCountyBoundaries,
  getFSProclaimed,
  getFSSurfaceOwnedWindow,
  getStateBoundaries,
} from "./utils.js";
import DateSelector from "./components/DateSelector.jsx";
import GoogleExport from "./components/GoogleExport.jsx";
import BlockingAlert from "./components/BlockingAlert.jsx";

const Container = styled(Box)({
  display: "flex",
  height: "100vh",
  width: "100%",
});

const MenuPanel = styled(Paper)({
  width: "25%",
  height: "100%",
  padding: "16px",
  borderRadius: 0,
  borderRight: "1px solid rgba(0, 0, 0, 0.12)",
});

const StyledMapContainer = styled(Box)({
  width: "75%",
  height: "100%",
  "& .leaflet-container": {
    // Add this to ensure Leaflet map takes full space
    height: "100%",
    width: "100%",
  },
});

const MapEventHandler = ({ setMapBounds }) => {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      setMapBounds({
        bounds: [
          [bounds.getSouth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()],
        ],
        zoom: zoom,
      });
    },
  });

  // Set initial bounds
  useEffect(() => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    setMapBounds({
      bounds: [
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()],
      ],
      zoom: zoom,
    });
  }, [map]);

  return null;
};

const EarthEngineMap = (props) => {
  const {
    bounds,
    setBounds,
    preImageUrl,
    postImageUrl,
    combinedCloudMaskUrl,
    ndviChangeUrl,
    ndviChangeForestMaskUrl,
    ndviChangeDeciduousMaskUrl,
    ndviChangeEvergreenMaskUrl,
    ndviChangeWaterMaskUrl,
  } = props;

  const [stateBoundaries, setStateBoundaries] = useState(null);
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [fsProclaimed, setFsProclaimed] = useState(null);
  const [fsSurfaceOwnedWindow, setFsSurfaceOwnedWindow] = useState(false);
  const [hillshade, setHillshade] = useState(null);

  if (!stateBoundaries) {
    setStateBoundaries(getStateBoundaries());
  }

  if (!countyBoundaries) {
    setCountyBoundaries(getCountyBoundaries());
  }

  if (!fsProclaimed) {
    setFsProclaimed(getFSProclaimed());
  }

  if (!fsSurfaceOwnedWindow) {
    setFsSurfaceOwnedWindow(getFSSurfaceOwnedWindow());
  }

  if (!hillshade) {
    setHillshade(addHillshade());
  }

  return (
    <MapContainer
      center={[35.597, -82.546]}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
    >
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@latest/dist/leaflet.css"
      />
      <MapEventHandler setMapBounds={setBounds} />
      <LayersControl position="topleft">
        <LayersControl.Overlay checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.Overlay>
      </LayersControl>
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="State borders">
          <TileLayer url={stateBoundaries} attribution="Google Earth Engine" />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="County borders">
          <TileLayer url={countyBoundaries} attribution="Google Earth Engine" />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="FS Proclaimed">
          <TileLayer url={fsProclaimed} attribution="Google Earth Engine" />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="FS Surface-Owned window">
          <TileLayer
            url={fsSurfaceOwnedWindow}
            attribution="Google Earth Engine"
          />
        </LayersControl.Overlay>
        <LayersControl.Overlay name="Hillshade">
          <TileLayer url={hillshade} attribution="Google Earth Engine" />
        </LayersControl.Overlay>
        {combinedCloudMaskUrl && bounds && (
          <LayersControl.Overlay checked name="Combined Cloud Mask">
            <TileLayer
              key={combinedCloudMaskUrl}
              url={combinedCloudMaskUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {ndviChangeForestMaskUrl && bounds && (
          <LayersControl.Overlay checked name="NDVI Change - Forest Only">
            <TileLayer
              key={ndviChangeForestMaskUrl}
              url={ndviChangeForestMaskUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {ndviChangeDeciduousMaskUrl && bounds && (
          <LayersControl.Overlay name="NDVI Change - Deciduous Only">
            <TileLayer
              key={ndviChangeDeciduousMaskUrl}
              url={ndviChangeDeciduousMaskUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {ndviChangeEvergreenMaskUrl && bounds && (
          <LayersControl.Overlay name="NDVI Change - Evergreen Only">
            <TileLayer
              key={ndviChangeEvergreenMaskUrl}
              url={ndviChangeEvergreenMaskUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {ndviChangeWaterMaskUrl && bounds && (
          <LayersControl.Overlay name="NDVI Change - No Water">
            <TileLayer
              key={ndviChangeWaterMaskUrl}
              url={ndviChangeWaterMaskUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {ndviChangeUrl && bounds && (
          <LayersControl.Overlay name="NDVI Change - All Lands">
            <TileLayer
              key={ndviChangeUrl}
              url={ndviChangeUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {preImageUrl && bounds && (
          <LayersControl.Overlay name="Pre True Color">
            <TileLayer
              key={preImageUrl}
              url={preImageUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
        {postImageUrl && bounds && (
          <LayersControl.Overlay name="Post True Color">
            <TileLayer
              key={postImageUrl}
              url={postImageUrl}
              attribution="Google Earth Engine"
            />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  );
};

const Selector = (props) => {
  const { options, handleChange, value, sx, label = "default label" } = props;

  return (
    <FormControl fullWidth sx={sx}>
      <InputLabel id="basic-select-label">{label}</InputLabel>
      <Select
        variant="outlined"
        labelId="basic-select-label"
        id="basic-select"
        value={value}
        label={label}
        onChange={handleChange}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleExportOpen, setGoogleExportOpen] = useState(false);
  const [googleExportFileName, setGoogleExportFileName] = useState(
    "forest_change_export_".concat(generateDateTimeString()),
  );
  const [googleExportFolder, setGoogleExportFolder] = useState(
    "earth_engine_exports",
  );
  const [googleExportSelectedImage, setGoogleExportSelectedImage] =
    useState("Forest Change");
  const [googleExportScale, setGoogleExportScale] = useState(10);
  const [googleExportCRS, setGoogleExportCRS] = useState("EPSG:4326");
  const [alert, setAlert] = useState({
    status: false,
    severity: "",
    message: "",
  });
  const [selectedSatellite, setSelectedSatellite] = useState(
    satellites["Sentinel 2 TOA"],
  );
  const [preStartDate, setPreStartDate] = useState("2023-06-01");
  const [preEndDate, setPreEndDate] = useState("2023-08-30");
  const [postStartDate, setPostStartDate] = useState("2024-06-01");
  const [postEndDate, setPostEndDate] = useState("2024-08-30");
  const [bounds, setBounds] = useState(null);
  const [preImage, setPreImage] = useState({ image: null, url: null });
  const [postImage, setPostImage] = useState({ image: null, url: null });
  const [cloudImage, setCloudImage] = useState({ image: null, url: null });
  const [ndviChange, setNdviChange] = useState({ image: null, url: null });
  const [ndviChangeForestMask, setNdviChangeForestMask] = useState({
    image: null,
    url: null,
  });
  const [ndviChangeDeciduousMask, setNdviChangeDeciduousMask] = useState({
    image: null,
    url: null,
  });
  const [ndviChangeEvergreenMask, setNdviChangeEvergreenMask] = useState({
    image: null,
    url: null,
  });
  const [ndviChangeWaterMask, setNdviChangeWaterMask] = useState({
    image: null,
    url: null,
  });
  const [eeTid, seteeTid] = useState(null);
  const [cloudThreshold, setCloudThreshold] = useState(
    cloudThresholds["Medium"],
  );

  const handleOpen = () => {
    if (!postImage.image) {
      setAlert({
        status: true,
        severity: "warning",
        message: 'Please click "Do The Change Analysis" before exporting.',
      });
      return;
    }
    setGoogleExportOpen(true);
  };
  const handleClose = () => {
    setAlert({
      status: true,
      severity: "success",
      message: "Image successfully exported.",
    });
    setGoogleExportOpen(false);
  };
  const satelliteList = Object.keys(satellites);
  const cloudThresholdList = Object.keys(cloudThresholds);
  const QA_BAND = "cs_cdf";

  const visParams = {
    bands: [
      selectedSatellite.bands.red,
      selectedSatellite.bands.green,
      selectedSatellite.bands.blue,
    ],
    min: selectedSatellite.min,
    max: selectedSatellite.max,
    gamma: 1.2,
  };

  const googleExportImages = {
    "Forest Change": {
      label: "Forest Change",
      description: "Forest Change Export",
      image: ndviChangeForestMask.image,
      filename: "forest_change_export_".concat(generateDateTimeString()),
    },
    "Post True Color": {
      label: "Post True Color",
      description: "Post True Color Export",
      image: postImage.image,
      filename: "post_true_color_export_".concat(generateDateTimeString()),
    },
    "Cloud Mask": {
      label: "Cloud Mask",
      description: "Cloud Mask Export",
      image: cloudImage.image,
      filename: "cloud_mask_export_".concat(generateDateTimeString()),
    },
  };

  const handleSatelliteChange = (event) => {
    setSelectedSatellite(satellites[event.target.value]);
    setGoogleExportScale(satellites[event.target.value].scale);
  };

  const handleCloudThresholdChange = (event) => {
    setCloudThreshold(cloudThresholds[event.target.value]);
  };

  const handleGoogleDriveExport = () => {
    const [[south, west], [north, east]] = bounds.bounds;
    const geometry = ee.Geometry.Rectangle([west, south, east, north]);
    console.log(googleExportImages[googleExportSelectedImage].image);

    // Create export task configuration
    const taskConfig = {
      type: "EXPORT_IMAGE",
      element: googleExportImages[googleExportSelectedImage].image,
      description: googleExportImages[googleExportSelectedImage].description,
      driveFileNamePrefix: googleExportFileName,
      driveFolder: googleExportFolder,
      region: geometry,
      scale: googleExportScale,
      maxPixels: 1e13,
      crs: googleExportCRS,
      fileFormat: "GEO_TIFF",
    };
    const task = ee.data.startProcessing(eeTid, taskConfig);
    console.log("jeff task", task);
    handleClose();
  };

  const handleGoogleCloudExport = () => {
    const [[south, west], [north, east]] = bounds.bounds;
    const geometry = ee.Geometry.Rectangle([west, south, east, north]);

    // Create export task configuration
    const taskConfig = {
      type: "EXPORT_IMAGE",
      element: googleExportImages[googleExportSelectedImage].image,
      description: "description",
      driveFileNamePrefix: googleExportFileName,
      bucket: googleExportFolder,
      region: geometry,
      scale: selectedSatellite.scale || 30,
      maxPixels: 1e13,
      crs: "EPSG:4326",
      fileFormat: "GEO_TIFF",
    };
    const task = ee.data.startProcessing(eeTid, taskConfig);
    console.log("jeff task", task);
    handleClose();
  };

  const addNDVI = (satelliteProps) => {
    const mapper = function (image) {
      const ndvi = image
        .normalizedDifference([
          satelliteProps.bands.nir,
          satelliteProps.bands.red,
        ])
        .rename("NDVI");
      return image.addBands(ndvi);
    };
    return mapper;
  };

  const addDate = (image) => {
    const date = ee.Date(image.get("system:time_start"));
    const dateString = date.format("yyyyMMdd");
    const dateNumber = ee.Number.parse(dateString);
    const dateBand = ee.Image.constant(dateNumber).uint32().rename("date");
    return image.addBands(dateBand);
  };

  const processImagery = (bounds, satellite, startDate, endDate) => {
    const [[south, west], [north, east]] = bounds.bounds;
    const geometry = ee.Geometry.Rectangle([west, south, east, north]);
    // Cloud Score+ image collection. Note Cloud Score+ is produced from Sentinel-2
    // Level 1C data and can be applied to either L1C or L2A collections.
    const csPlus = ee.ImageCollection(
      "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
    );
    const imageCollection = ee
      .ImageCollection(satellite.satellite)
      .filterBounds(geometry)
      .filterDate(startDate, endDate)
      .map((img) => {
        return ["Sentinel 2 TOA", "Sentinel 2 SR"].includes(
          selectedSatellite.label,
        )
          ? img.linkCollection(csPlus, [QA_BAND])
          : img;
      });

    const withIndexAndDateImageCollection = imageCollection
      .map(addNDVI(selectedSatellite))
      .map(addDate);
    const greenestWithIndexAndDateImageCollection =
      withIndexAndDateImageCollection.qualityMosaic("NDVI");

    var greenestWithIndexAndDateImageCollectionClip =
      greenestWithIndexAndDateImageCollection.clip(geometry);

    return greenestWithIndexAndDateImageCollectionClip;
  };

  const processCombinedSatellitesImagery = (
    bounds,
    satellite,
    startDate,
    endDate,
  ) => {
    const [[south, west], [north, east]] = bounds.bounds;
    const geometry = ee.Geometry.Rectangle([west, south, east, north]);
    // Two keys are used here. sat0 and sat1. It's just an easy way to reference two different satellites to merge
    var sat0Bands = ee.Dictionary(satellite.sat0Bands);
    var sat0ImageCollection = ee
      .ImageCollection(satellite.sat0)
      .select(sat0Bands.values(), sat0Bands.keys());

    var sat1Bands = ee.Dictionary(satellite.sat1Bands);
    var sat1ImageCollection = ee
      .ImageCollection(satellite.sat1)
      .select(sat1Bands.values(), sat1Bands.keys());

    // Cloud Score+ image collection. Note Cloud Score+ is produced from Sentinel-2
    // Level 1C data and can be applied to either L1C or L2A collections.
    const csPlus = ee.ImageCollection(
      "GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED",
    );
    var combinedSatellitesImageCollection = ee
      .ImageCollection(sat0ImageCollection.merge(sat1ImageCollection))
      .filterBounds(geometry)
      .filterDate(startDate, endDate)
      .linkCollection(csPlus, [QA_BAND]);

    const withIndexAndDateImageCollection = combinedSatellitesImageCollection
      .map(addNDVI(selectedSatellite))
      .map(addDate);
    const greenestWithIndexAndDateImageCollection =
      withIndexAndDateImageCollection.qualityMosaic("NDVI");

    var greenestWithIndexAndDateImageCollectionClip =
      greenestWithIndexAndDateImageCollection.clip(geometry);

    return greenestWithIndexAndDateImageCollectionClip;
  };

  const handleAnalysisClick = () => {
    if (!bounds) {
      console.error("Map bounds not yet available");
      return;
    }
    const [[south, west], [north, east]] = bounds.bounds;
    const geometry = ee.Geometry.Rectangle([west, south, east, north]);
    seteeTid(ee.data.newTaskId());
    let preImage, postImage;

    try {
      // Process pre-disturbance imagery
      if (selectedSatellite.combined !== true) {
        preImage = processImagery(
          bounds,
          selectedSatellite,
          preStartDate,
          preEndDate,
        );
      } else {
        preImage = processCombinedSatellitesImagery(
          bounds,
          selectedSatellite,
          preStartDate,
          preEndDate,
        );
      }
      setPreImage({
        image: preImage,
        url: preImage.getMapId(visParams).urlFormat,
      });

      // Process pre-disturbance imagery
      if (selectedSatellite.combined !== true) {
        postImage = processImagery(
          bounds,
          selectedSatellite,
          postStartDate,
          postEndDate,
        );
      } else {
        postImage = processCombinedSatellitesImagery(
          bounds,
          selectedSatellite,
          postStartDate,
          postEndDate,
        );
      }
      setPostImage({
        image: postImage,
        url: postImage.getMapId(visParams).urlFormat,
      });

      if (
        selectedSatellite.label === "Sentinel 2 TOA" ||
        selectedSatellite.label === "Sentinel 2 SR"
      ) {
        const preCloudMask = preImage?.select(QA_BAND).lt(cloudThreshold.value);
        const postCloudMask = postImage
          ?.select(QA_BAND)
          .lt(cloudThreshold.value);
        const combinedCloudMask = preCloudMask?.or(postCloudMask);
        setCloudImage({
          image: combinedCloudMask,
          url: combinedCloudMask.selfMask().getMapId({ palette: ["000000"] })
            .urlFormat,
        });
      }

      const forestMask = NLCDForestMask(geometry);
      const deciduousMask = NLCDDeciduousMask(geometry);
      const evergreenMask = NLCDEvergreenMask(geometry);
      const waterMask = NLCDWaterMask(geometry);

      // TODO: incorporate percent change
      const postMinusPre = postImage.subtract(preImage);
      const absNDVIc = postMinusPre.select("NDVI");
      const absNDVIc_x100 = absNDVIc.multiply(100);
      const ndviChangeProduct = absNDVIc_x100.int8();

      setNdviChange({
        image: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .clip(geometry),
        url: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .clip(geometry)
          .getMapId(sldIntervalsAbsoluteNdvi).urlFormat,
      });

      setNdviChangeForestMask({
        image: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(forestMask)
          .clip(geometry),
        url: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(forestMask)
          .clip(geometry)
          .getMapId(sldIntervalsAbsoluteNdvi).urlFormat,
      });

      setNdviChangeDeciduousMask({
        image: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(deciduousMask)
          .clip(geometry),
        url: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(deciduousMask)
          .clip(geometry)
          .getMapId(sldIntervalsAbsoluteNdvi).urlFormat,
      });

      setNdviChangeEvergreenMask({
        image: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(evergreenMask)
          .clip(geometry),
        url: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(evergreenMask)
          .clip(geometry)
          .getMapId(sldIntervalsAbsoluteNdvi).urlFormat,
      });

      setNdviChangeWaterMask({
        image: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(waterMask)
          .clip(geometry),
        url: ndviChangeProduct
          .sldStyle(sldIntervalsAbsoluteNdvi)
          .mask(waterMask)
          .clip(geometry)
          .getMapId(sldIntervalsAbsoluteNdvi).urlFormat,
      });

      // process NDVI imagery
    } catch (error) {
      console.error("Error processing imagery:", error);
    }
  };

  return (
    <div>
      {alert.status && (
        <BlockingAlert
          alert={alert}
          onClose={() => setAlert({ status: false, severity: "", message: "" })}
        />
      )}
      {!isAuthenticated ? (
        <AuthButton setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <Container>
          <MenuPanel>
            <Selector
              options={satelliteList}
              value={selectedSatellite.label}
              handleChange={handleSatelliteChange}
              label={"Choose Satellite"}
              sx={{ mb: 2 }}
            />
            <Selector
              options={cloudThresholdList}
              value={cloudThreshold.label}
              handleChange={handleCloudThresholdChange}
              label={"Choose Cloud Threshold"}
              sx={{ mb: 2 }}
            />
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <div style={{ display: "flex", gap: "20px" }}>
                <DateSelector
                  label="Pre-Disturbance Start Date"
                  value={dayjs(preStartDate)}
                  onChange={(newValue) => {
                    const formattedDate = dayjs(newValue).format("YYYY-MM-DD");
                    setPreStartDate(formattedDate);
                  }}
                  minDate={dayjs(selectedSatellite.startDate)}
                  maxDate={dayjs(selectedSatellite.endDate)}
                />
                <DateSelector
                  label="Pre-Disturbance End Date"
                  value={dayjs(preEndDate)}
                  onChange={(newValue) => {
                    const formattedDate = dayjs(newValue).format("YYYY-MM-DD");
                    setPreEndDate(formattedDate);
                  }}
                  minDate={dayjs(selectedSatellite.startDate)}
                  maxDate={dayjs(selectedSatellite.endDate)}
                />
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                <DateSelector
                  label="Post-Disturbance Start Date"
                  value={dayjs(postStartDate)}
                  onChange={(newValue) => {
                    const formattedDate = dayjs(newValue).format("YYYY-MM-DD");
                    setPostStartDate(formattedDate);
                  }}
                  minDate={dayjs(selectedSatellite.startDate)}
                  maxDate={dayjs(selectedSatellite.endDate)}
                />
                <DateSelector
                  label="Post-Disturbance End Date"
                  value={dayjs(postEndDate)}
                  onChange={(newValue) => {
                    const formattedDate = dayjs(newValue).format("YYYY-MM-DD");
                    setPostEndDate(formattedDate);
                  }}
                  minDate={dayjs(selectedSatellite.startDate)}
                  maxDate={dayjs(selectedSatellite.endDate)}
                />
              </div>
            </LocalizationProvider>
            <div style={{ display: "flex", gap: "20px" }}>
              <Button
                sx={{ mb: 2 }}
                variant="contained"
                onClick={handleAnalysisClick}
              >
                Do the change analysis
              </Button>
            </div>
            <div style={{ display: "flex", gap: "20px" }}>
              <Button sx={{ mb: 2 }} variant="contained" onClick={handleOpen}>
                Export Image
              </Button>
              <Dialog
                open={googleExportOpen}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
              >
                <DialogContent>
                  <GoogleExport
                    onFileNameChange={(event) => {
                      setGoogleExportFileName(event.target.value);
                    }}
                    onFolderChange={(event) => {
                      setGoogleExportFolder(event.target.value);
                    }}
                    onImageChange={(event) => {
                      setGoogleExportSelectedImage(
                        googleExportImages[event.target.value].label,
                      );
                      setGoogleExportFileName(
                        googleExportImages[event.target.value].filename,
                      );
                    }}
                    onScaleChange={(event) => {
                      setGoogleExportScale(event.target.value);
                    }}
                    onCRSChange={(event) => {
                      setGoogleExportCRS(event.target.value);
                    }}
                    folder={googleExportFolder}
                    fileName={googleExportFileName}
                    scale={googleExportScale}
                    crs={googleExportCRS}
                    selectedImage={googleExportSelectedImage}
                    images={googleExportImages}
                    onCancel={handleClose}
                    onDriveSubmit={handleGoogleDriveExport}
                    onCloudSubmit={handleGoogleCloudExport}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </MenuPanel>
          <StyledMapContainer>
            <EarthEngineMap
              bounds={bounds}
              setBounds={setBounds}
              preImageUrl={preImage.url}
              postImageUrl={postImage.url}
              combinedCloudMaskUrl={cloudImage.url}
              ndviChangeUrl={ndviChange.url}
              ndviChangeForestMaskUrl={ndviChangeForestMask.url}
              ndviChangeDeciduousMaskUrl={ndviChangeDeciduousMask.url}
              ndviChangeEvergreenMaskUrl={ndviChangeEvergreenMask.url}
              ndviChangeWaterMaskUrl={ndviChangeWaterMask?.url}
            />
          </StyledMapContainer>
        </Container>
      )}
    </div>
  );
};

export default App;
