export const NLCDForestMask = (geometry) => {
  const dataset21 = ee.ImageCollection("USGS/NLCD_RELEASES/2021_REL/NLCD");
  const nlcd2021 = dataset21
    .filter(ee.Filter.eq("system:index", "2021"))
    .first();
  const nlcd_2021_landcover_img = nlcd2021.select("landcover");
  const forest2021 = nlcd_2021_landcover_img
    .eq(41)
    .or(nlcd_2021_landcover_img.eq(42))
    .or(nlcd_2021_landcover_img.eq(43))
    .or(nlcd_2021_landcover_img.eq(90));
  return forest2021.eq(1).clip(geometry);
};

export const NLCDDeciduousMask = (geometry) => {
  const dataset21 = ee.ImageCollection("USGS/NLCD_RELEASES/2021_REL/NLCD");
  const nlcd2021 = dataset21
    .filter(ee.Filter.eq("system:index", "2021"))
    .first();
  const nlcd_2021_landcover_img = nlcd2021.select("landcover");
  const deciduous2021 = nlcd_2021_landcover_img
    .eq(41)
    .or(nlcd_2021_landcover_img.eq(43))
    .or(nlcd_2021_landcover_img.eq(90));
  return deciduous2021.eq(1).clip(geometry);
};

export const NLCDEvergreenMask = (geometry) => {
  const dataset21 = ee.ImageCollection("USGS/NLCD_RELEASES/2021_REL/NLCD");
  const nlcd2021 = dataset21
    .filter(ee.Filter.eq("system:index", "2021"))
    .first();
  const nlcd_2021_landcover_img = nlcd2021.select("landcover");
  const evergreen2021 = nlcd_2021_landcover_img
    .eq(42)
    .or(nlcd_2021_landcover_img.eq(43));
  return evergreen2021.eq(1).clip(geometry);
};

export const NLCDWaterMask = () => {
  const dataset21 = ee.ImageCollection("USGS/NLCD_RELEASES/2021_REL/NLCD");
  const nlcd2021 = dataset21
    .filter(ee.Filter.eq("system:index", "2021"))
    .first();
  const nlcd_2021_landcover_img = nlcd2021.select("landcover");
  // mask out water
  return nlcd_2021_landcover_img
    .eq(21)
    .or(nlcd_2021_landcover_img.eq(22))
    .or(nlcd_2021_landcover_img.eq(23))
    .or(nlcd_2021_landcover_img.eq(24))
    .or(nlcd_2021_landcover_img.eq(31))
    .or(nlcd_2021_landcover_img.eq(41))
    .or(nlcd_2021_landcover_img.eq(42))
    .or(nlcd_2021_landcover_img.eq(43))
    .or(nlcd_2021_landcover_img.eq(52))
    .or(nlcd_2021_landcover_img.eq(71))
    .or(nlcd_2021_landcover_img.eq(81))
    .or(nlcd_2021_landcover_img.eq(82))
    .or(nlcd_2021_landcover_img.eq(90));
};
