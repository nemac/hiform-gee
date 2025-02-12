import { useEffect, useState } from "react";
import { Button } from "@mui/material";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  LayersControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const AuthButton = (props) => {
  const { setIsAuthenticated } = props;
  const handleAuth = () => {
    const CLIENT_ID = "insert client_id here";

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

const EarthEngineMap = () => {
  const [imageUrl, setImageUrl] = useState(null);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    // Get a Landsat image for San Francisco area
    const geometry = ee.Geometry.Rectangle([-122.6, 37.6, -122.2, 37.9]);
    // Get Sentinel-2 TOA image collection
    const image = ee
      .ImageCollection("COPERNICUS/S2_HARMONIZED")
      .filterBounds(geometry)
      .filterDate("2023-01-01", "2023-12-31") // Recent imagery from 2023
      .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20)) // Filter for less cloudy images
      .sort("CLOUDY_PIXEL_PERCENTAGE") // Sort by cloud coverage
      .first(); // Get the least cloudy image

    // RGB visualization parameters
    const visParams = {
      bands: ["B4", "B3", "B2"], // True color
      min: 0,
      max: 3000,
      gamma: 1.2,
    };
    setImageUrl(image.getMapId(visParams).urlFormat);

    setBounds([
      [37.6, -122.6], // Southwest corner
      [37.9, -122.2], // Northeast corner
    ]);
  }, []);

  return (
    <MapContainer center={[37.75, -122.4]} zoom={11} style={{ height: "100%" }}>
      <LayersControl position="topright">
        <LayersControl.Overlay checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.Overlay>

        {imageUrl && bounds && (
          <LayersControl.Overlay checked name="Landsat Image">
            <TileLayer url={imageUrl} attribution="Google Earth Engine" />
          </LayersControl.Overlay>
        )}
      </LayersControl>
    </MapContainer>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  return (
    <div style={{ height: "1000px", width: "2200px" }}>
      {!isAuthenticated ? (
        <AuthButton setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <EarthEngineMap />
      )}
    </div>
  );
};

export default App;
