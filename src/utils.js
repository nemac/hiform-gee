export const generateDateTimeString = (date = new Date()) => {
  // Get individual date/time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is 0-indexed
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Combine into the desired format
  return `${year}${month}${day}_${hours}_${minutes}_${seconds}`;
};

export const getStateBoundaries = () => {
  return ee
    .Image()
    .float()
    .paint({
      featureCollection: ee.FeatureCollection("TIGER/2016/States"),
      color: "black",
      width: 3,
    })
    .getMapId().urlFormat;
};

export const getCountyBoundaries = () => {
  return ee
    .Image()
    .float()
    .paint({
      featureCollection: ee.FeatureCollection("TIGER/2016/Counties"),
      color: "black",
      width: 1,
    })
    .getMapId().urlFormat;
};

export const getFSProclaimed = () => {
  return ee
    .Image()
    .byte()
    .paint({
      featureCollection: ee.FeatureCollection(
        "users/srs4854gee/fs_proclaimed_042622",
      ),
      color: 1,
      width: 1.5,
    })
    .getMapId().urlFormat;
};

export const getFSSurfaceOwnedWindow = () => {
  const clipped_allproc_surfwindow = ee.FeatureCollection(
    "users/srs4854gee/non_fs_082023",
  );
  const vis = {
    fillColor: "00000080",
    width: 0,
  };

  return clipped_allproc_surfwindow.style(vis).getMapId().urlFormat;
};

export const addHillshade = () => {
  const elevation = ee.Image("USGS/3DEP/10m").select("elevation");
  const hillshade = ee.Terrain.hillshade(elevation);
  const vis = {
    min: 0.0,
    max: 255.0,
    gamma: 0.4,
    opacity: 0.25,
  };

  return hillshade.getMapId(vis).urlFormat;
};
