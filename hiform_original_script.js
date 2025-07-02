////////////////////////////////////////////////////////////////
//  HIFORM NDVI CHANGE SCRIPT (https://HiForm.org)
////////////////////////////////////////////////////////////////

// 'Absolute Change in NDVI' using Sentinel-2 and Landsat image collections
//    FS vs non-FS exporting, see line 1260 - selection sets export beharior

// Bill Christie, RS/GIS Analyst, USFS, Southern Research Station, william.m.christie@usda.gov
// Steve Norman, Research Landscape Ecologist, USFS, Southern Research Station, steve.norman@usda.gov
//    Resources - https://hiform.org/mapping-workflow
//
// Script Author and Maintainers:
// National Environmental Modeling and Analysis Center (NEMAC)
// https://nemac.unca.edu/
// Jeff Bliss (jbliss@unca.edu)
// Dave Michelson (dmichels@unca.edu)
// Sean Matthew (smatthe2@unca.edu)

var table = ee.FeatureCollection('users/srs4854gee/fs_proclaimed_042622');

// Cloud Score+ image collection. Note Cloud Score+ is produced from Sentinel-2
// Level 1C data and can be applied to either L1C or L2A collections.
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

var user = 'FS'; // all 3 unsubmitted, DEFAULT state
//var user = 'NonFS'; // all 3 auto-export to g-drive
// limit draw tools to just polygon

// Map configuration
var map = Map;
map.setControlVisibility(true);
var lng = ui.url.get('lng', -82.5795);
var lat = ui.url.get('lat', 35.592);
var mapZoom = ui.url.get('mapZoom', 12);
map.setCenter(lng, lat, mapZoom);
var drawingTools = Map.drawingTools();
drawingTools.setDrawModes(['polygon', 'point']);

// script global variables
var stateBordersLayer; // storing globally to be able to rerender later
var countyBordersLayer; // storing globally to be able to rerender later
var fsProclaimedLayer; // storing globally to be able to rerender later
var fsSurfaceOwnedWindowLayer; // storing globally to be able to rerender later
var hillshadeLayer; // storing globally to be able to rerender later
var ndviChangeForestOnlyLayer; // storing globally to be able to rerender later
var ndviChangeEvergreenLayer; // storing globally to be able to rerender later
var ndviChangeDeciduousLayer; // storing globally to be able to rerender later
var ndviChangeAllLandsLayer; // storing globally to be able to rerender later
var ndviChangeNoWaterLayer; // storing globally to be able to rerender later
var preImageGreenestClip; // includes date and chosen index (NDVI at the moment)
var postImageGreenestClip; // includes date and chosen index (NDVI at the moment)
var preTrueColorLayer; // storing globally to be able to rerender later
var postTrueColorLayer; // storing globally to be able to rerender later
var ndviChangeProduct; // NDVI product
var combinedCloudMask; // pre and post combined cloud mask using Cloud Score+ Image Collection
var exportImageGeometry; // Capture map extent when "Do the change analysis" is clicked and use for export
var defaultSatellite = ui.url.get('satellite', 'Sentinel 2 TOA');
var currentDate = ee.Date(Date.now());
var currentDateString = ee.Date(Date.now()).format('yyyy-MM-dd').getInfo();
var inspectorLabelDefaultMsg = 'Click on a location for: \n- Dates used\n- NDVI\n- Min and max values';
var CLOUD_THRESHOLD = 0.725;
var QA_BAND = 'cs_cdf';
var submitCounter = 0; // count the asynchronous calls to decide when to re-enable submit
var layerReadyCounter = 0; // used to determine when pre and post true color are rendered
var sentinel3ZoomListener; // global variable for map on zoom listener in sentinel 3 submit change analysis
var changeType = ui.url.get('changeType', 'ABSOLUTE_NDVI');

var SATELLITE_PROPERTIES = {
  'Sentinel 2 TOA': {
    satellite: 'COPERNICUS/S2_HARMONIZED',
    scale: 10,
    bands: {
      blue: 'B2',
      green: 'B3',
      red: 'B4',
      nir: 'B8',
      'red edge 4': 'B8A',
      cirrus: 'B10',
      swir1: 'B11',
      swir2: 'B12',
      ndvi: 'NDVI',
    },
    falseAgMin: 0,
    falseAgMax: 0.4,
    min: 300,
    max: 1500,
    startDate: '2015-06-23',
    endDate: currentDateString,
  },
  'Sentinel 2 SR': {
    satellite: 'COPERNICUS/S2_SR_HARMONIZED',
    scale: 10,
    bands: {
      blue: 'B2',
      green: 'B3',
      red: 'B4',
      nir: 'B8',
      'red edge 4': 'B8A',
      cirrus: 'B10',
      swir1: 'B11',
      swir2: 'B12',
      ndvi: 'NDVI',
    },
    falseAgMin: 0,
    falseAgMax: 0.4,
    min: 300,
    max: 1500,
    startDate: '2017-03-28',
    endDate: currentDateString,
  },
  'Sentinel 3 TOA': {
    satellite: 'COPERNICUS/S3/OLCI',
    scale: 240,
    bands: {
      blue: 'Oa04_radiance',
      green: 'Oa06_radiance',
      red: 'Oa08_radiance',
      oa12: 'Oa12_radiance',
      nir: 'Oa17_radiance',
      oa20: 'Oa20_radiance'
    },
    min: 15,
    max: 70,
    gamma: 2.0,
    startDate: '2016-10-18',
    endDate: currentDateString
  },
  // The combined objects below have this weirdish looking thing for the "bands" key but it's
  // done this way so we don't have to rewrite everything else. Essentially the "sat0Bands" and "sat1Bands"
  // objects help the combiner resolve what band is associated with what and then the "bands"
  // object exists so other functions that look up key.bands don't have to be rewritten just for combined
  // satellites. e.g. key.bands.blue returns "blue" instead of "B1" and the visualizer resolves it just fine
  'L5/L8 TOA Combined': {
    combined: true,
    keys: ['Landsat 5 TOA', 'Landsat 8 TOA'],
    sat0: 'LANDSAT/LT05/C02/T1_TOA',
    sat0Bands: { blue: 'B1', green: 'B2', red: 'B3', nir: 'B4', swir1: 'B5', swir2: 'B7' },
    sat1: 'LANDSAT/LC08/C02/T1_TOA',
    sat1Bands: { blue: 'B2', green: 'B3', red: 'B4', nir: 'B5', swir1: 'B6', swir2: 'B7' },
    bands: { blue: 'blue', green: 'green', red: 'red', nir: 'nir', swir1: 'swir1', swir2: 'swir2' },
    startDate: '1984-03',
    endDate: currentDateString,
    scale: 30,
    min: 0,
    max: 0.4,
  },
  'L5/L8 SR Combined': {
    combined: true,
    keys: ['Landsat 5 SR', 'Landsat 8 SR'],
    sat0: 'LANDSAT/LT05/C02/T1_L2',
    sat0Bands: { blue: 'SR_B1', green: 'SR_B2', red: 'SR_B3', nir: 'SR_B4', swir1: 'SR_B5', swir2: 'SR_B7' },
    sat1: 'LANDSAT/LC08/C02/T1_L2',
    sat1Bands: { blue: 'SR_B2', green: 'SR_B3', red: 'SR_B4', nir: 'SR_B5', swir1: 'SR_B6', swir2: 'SR_B7' },
    bands: { blue: 'blue', green: 'green', red: 'red', nir: 'nir', swir1: 'swir1', swir2: 'swir2' },
    startDate: '1984-03',
    endDate: currentDateString,
    scale: 30,
    min: 5000,
    max: 15000,
  },
  'L8/L9 TOA Combined': {
    combined: true,
    keys: ['Landsat 8 TOA', 'Landsat 9 TOA'],
    sat0: 'LANDSAT/LC08/C02/T1_TOA',
    sat0Bands: { blue: 'B2', green: 'B3', red: 'B4', nir: 'B5', swir1: 'B6', swir2: 'B7' },
    sat1: 'LANDSAT/LC09/C02/T1_TOA',
    sat1Bands: { blue: 'B2', green: 'B3', red: 'B4', nir: 'B5', swir1: 'B6', swir2: 'B7' },
    bands: { blue: 'blue', green: 'green', red: 'red', nir: 'nir', swir1: 'swir1', swir2: 'swir2' },
    startDate: '2013',
    endDate: currentDateString,
    scale: 30,
    min: 0,
    max: 0.4,
  },
  'L8/L9 SR Combined': {
    combined: true,
    sat0: 'LANDSAT/LC08/C02/T1_L2',
    sat0Bands: { blue: 'SR_B2', green: 'SR_B3', red: 'SR_B4', nir: 'SR_B5', swir1: 'SR_B6', swir2: 'SR_B7' },
    sat1: 'LANDSAT/LC09/C02/T1_L2',
    sat1Bands: { blue: 'SR_B2', green: 'SR_B3', red: 'SR_B4', nir: 'SR_B5', swir1: 'SR_B6', swir2: 'SR_B7' },
    bands: { blue: 'blue', green: 'green', red: 'red', nir: 'nir', swir1: 'swir1', swir2: 'swir2' },
    startDate: '2013',
    endDate: currentDateString,
    scale: 30,
    min: 5000,
    max: 15000,
  },
  'L8/L9 Real-Time Combined': {
    combined: true,
    sat0: 'LANDSAT/LC08/C02/T1_RT_TOA',
    sat0Bands: { blue: 'B2', green: 'B3', red: 'B4', nir: 'B5', swir1: 'B6', swir2: 'B7' },
    sat1: 'LANDSAT/LC09/C02/T1_TOA',
    sat1Bands: { blue: 'B2', green: 'B3', red: 'B4', nir: 'B5', swir1: 'B6', swir2: 'B7' },
    bands: { blue: 'blue', green: 'green', red: 'red', nir: 'nir', swir1: 'swir1', swir2: 'swir2' },
    scale: 30,
    min: 0.03,
    max: 0.2,
    startDate: '2013-03-18',
    endDate: currentDateString,
  },
};

var percentLegendPallete = {
  '>25': '000096',
  '11 to 25': '0000FF',
  '6 to 10': '0070FF',
  '-1 to 5': '6EBFFF',
  '-2 to -3': 'F3F6F4',
  '-4 to -6': 'D2D2D2',
  '-7 to -9': 'FFFFBE',
  '-10 to -12': 'FFFF00',
  '-13 to -15': 'FFD37F',
  '-16 to -18': 'FFAA00',
  '-19 to -21': 'E64C00',
  '-22 to -25': 'A80000',
  '-26 to -29': '730000',
  '-30 to -33': '343434',
  '-34 to -37': '4C0073',
  '< -37': '8400A8',
};

var absoluteLegendPallete = {
  '>25': '000096',
  '11 to 25': '0000FF',
  '6 to 10': '0070FF',
  '-3 to 5': '6EBFFF',
  '-4 to -6': 'D2D2D2',
  '-7 to -9': 'FFFFBE',
  '-10 to -12': 'FFFF00',
  '-13 to -15': 'FFD37F',
  '-16 to -18': 'FFAA00',
  '-19 to -21': 'E64C00',
  '-22 to -25': 'A80000',
  '-26 to -29': '730000',
  '-30 to -33': '343434',
  '-34 to -37': '4C0073',
  '< -37': '8400A8',
};

// DN value to RGB colormap assignment
// Define an SLD style of discrete intervals to apply to the image.
var sld_intervals_absolute_ndvi =
  '<RasterSymbolizer>' +
  '<ColorMap type="intervals" extended="false" >' +
  '<ColorMapEntry color="#000096" quantity="70" />' + //R 0;G 0 ;B 150; verydarkblue
  '<ColorMapEntry color="#000096" quantity="69" />' +
  '<ColorMapEntry color="#000096" quantity="68" />' +
  '<ColorMapEntry color="#000096" quantity="67" />' +
  '<ColorMapEntry color="#000096" quantity="66" />' +
  '<ColorMapEntry color="#000096" quantity="65" />' +
  '<ColorMapEntry color="#000096" quantity="64" />' +
  '<ColorMapEntry color="#000096" quantity="63" />' +
  '<ColorMapEntry color="#000096" quantity="62" />' +
  '<ColorMapEntry color="#000096" quantity="62" />' +
  '<ColorMapEntry color="#000096" quantity="61" />' +
  '<ColorMapEntry color="#000096" quantity="60" />' +
  '<ColorMapEntry color="#000096" quantity="59" />' +
  '<ColorMapEntry color="#000096" quantity="58" />' +
  '<ColorMapEntry color="#000096" quantity="57" />' +
  '<ColorMapEntry color="#000096" quantity="56" />' +
  '<ColorMapEntry color="#000096" quantity="55" />' +
  '<ColorMapEntry color="#000096" quantity="54" />' +
  '<ColorMapEntry color="#000096" quantity="53" />' +
  '<ColorMapEntry color="#000096" quantity="52" />' +
  '<ColorMapEntry color="#000096" quantity="52" />' +
  '<ColorMapEntry color="#000096" quantity="51" />' +
  '<ColorMapEntry color="#000096" quantity="50" />' +
  '<ColorMapEntry color="#000096" quantity="49" />' +
  '<ColorMapEntry color="#000096" quantity="48" />' +
  '<ColorMapEntry color="#000096" quantity="47" />' +
  '<ColorMapEntry color="#000096" quantity="46" />' +
  '<ColorMapEntry color="#000096" quantity="45" />' +
  '<ColorMapEntry color="#000096" quantity="44" />' +
  '<ColorMapEntry color="#000096" quantity="43" />' +
  '<ColorMapEntry color="#000096" quantity="42" />' +
  '<ColorMapEntry color="#000096" quantity="42" />' +
  '<ColorMapEntry color="#000096" quantity="41" />' +
  '<ColorMapEntry color="#000096" quantity="40" />' +
  '<ColorMapEntry color="#000096" quantity="39" />' +
  '<ColorMapEntry color="#000096" quantity="38" />' +
  '<ColorMapEntry color="#000096" quantity="37" />' +
  '<ColorMapEntry color="#000096" quantity="36" />' +
  '<ColorMapEntry color="#000096" quantity="35" />' +
  '<ColorMapEntry color="#000096" quantity="34" />' +
  '<ColorMapEntry color="#000096" quantity="33" />' +
  '<ColorMapEntry color="#000096" quantity="32" />' +
  '<ColorMapEntry color="#000096" quantity="31" />' +
  '<ColorMapEntry color="#000096" quantity="30" />' +
  '<ColorMapEntry color="#000096" quantity="29" />' +
  '<ColorMapEntry color="#000096" quantity="28" />' +
  '<ColorMapEntry color="#000096" quantity="27" />' +
  '<ColorMapEntry color="#000096" quantity="26" />' +
  '<ColorMapEntry color="#0000FF" quantity="25" />' + //R 0;G 0 ;B 255; darkblue
  '<ColorMapEntry color="#0000FF" quantity="24" />' +
  '<ColorMapEntry color="#0000FF" quantity="23" />' +
  '<ColorMapEntry color="#0000FF" quantity="22" />' +
  '<ColorMapEntry color="#0000FF" quantity="22" />' +
  '<ColorMapEntry color="#0000FF" quantity="21" />' +
  '<ColorMapEntry color="#0000FF" quantity="20" />' +
  '<ColorMapEntry color="#0000FF" quantity="19" />' +
  '<ColorMapEntry color="#0000FF" quantity="18" />' +
  '<ColorMapEntry color="#0000FF" quantity="17" />' +
  '<ColorMapEntry color="#0000FF" quantity="16" />' +
  '<ColorMapEntry color="#0000FF" quantity="15" />' +
  '<ColorMapEntry color="#0000FF" quantity="14" />' +
  '<ColorMapEntry color="#0000FF" quantity="13" />' +
  '<ColorMapEntry color="#0000FF" quantity="12" />' +
  '<ColorMapEntry color="#0000FF" quantity="11" />' +
  '<ColorMapEntry color="#0070FF" quantity="10" />' + //R 0;G 112 ;B 255; mediumblue
  '<ColorMapEntry color="#0070FF" quantity="09" />' +
  '<ColorMapEntry color="#0070FF" quantity="08" />' +
  '<ColorMapEntry color="#0070FF" quantity="07" />' +
  '<ColorMapEntry color="#0070FF" quantity="06" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="05" />' + //R 110;G 190 ;B 255; lightblue
  '<ColorMapEntry color="#6EBFFF" quantity="04" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="03" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="02" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="01" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="00" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="-01" />' + //R 110;G 190 ;B 255; lightblue
  '<ColorMapEntry color="#6EBFFF" quantity="-02" />' + //R 110;G 190 ;B 255; lightblue
  '<ColorMapEntry color="#6EBFFF" quantity="-03" />' + //R 110;G 190 ;B 255; lightblue
  // '<ColorMapEntry color="#f3f6f4" quantity="-01" />' + //R 210;G 210;B 210; lightgrey
  // '<ColorMapEntry color="#f3f6f4" quantity="-02" />' + //R 210;G 210;B 210; lightgrey
  // '<ColorMapEntry color="#f3f6f4" quantity="-03" />' + //R 210;G 210;B 210; lightgrey

  '<ColorMapEntry color="#D2D2D2" quantity="-04" />' + //R 210;G 210;B 210; lightgrey
  '<ColorMapEntry color="#D2D2D2" quantity="-05" />' +
  '<ColorMapEntry color="#D2D2D2" quantity="-06" />' +
  '<ColorMapEntry color="#FFFFBE" quantity="-07" />' + //R 255;G 255;B 190; buffyellow
  '<ColorMapEntry color="#FFFFBE" quantity="-08" />' +
  '<ColorMapEntry color="#FFFFBE" quantity="-09" />' +
  '<ColorMapEntry color="#FFFF00" quantity="-10" />' + //R 255;G 255;B 0; brightyellow
  '<ColorMapEntry color="#FFFF00" quantity="-11" />' +
  '<ColorMapEntry color="#FFFF00" quantity="-12" />' +
  '<ColorMapEntry color="#FFD37F" quantity="-13" />' + //R 255;G 211;B 127; lightorange
  '<ColorMapEntry color="#FFD37F" quantity="-14" />' +
  '<ColorMapEntry color="#FFD37F" quantity="-15" />' +
  '<ColorMapEntry color="#FFAA00" quantity="-16" />' + //R 255;G 170;B 0; redorange
  '<ColorMapEntry color="#FFAA00" quantity="-17" />' +
  '<ColorMapEntry color="#FFAA00" quantity="-18" />' +
  '<ColorMapEntry color="#E64C00" quantity="-19" />' + //R 230;G 76;B 0; darkred
  '<ColorMapEntry color="#E64C00" quantity="-20" />' +
  '<ColorMapEntry color="#E64C00" quantity="-21" />' +
  '<ColorMapEntry color="#A80000" quantity="-22" />' + //R 168;G 0;B 0; verydarkred
  '<ColorMapEntry color="#A80000" quantity="-23" />' +
  '<ColorMapEntry color="#A80000" quantity="-24" />' +
  '<ColorMapEntry color="#A80000" quantity="-25" />' +
  '<ColorMapEntry color="#730000" quantity="-26" />' + //R 115;G 0;B 0; beet
  '<ColorMapEntry color="#730000" quantity="-27" />' +
  '<ColorMapEntry color="#730000" quantity="-28" />' +
  '<ColorMapEntry color="#730000" quantity="-29" />' +
  '<ColorMapEntry color="#343434" quantity="-30" />' + //R 52;G 52;B 52; slate
  '<ColorMapEntry color="#343434" quantity="-31" />' +
  '<ColorMapEntry color="#343434" quantity="-32" />' +
  '<ColorMapEntry color="#343434" quantity="-33" />' +
  '<ColorMapEntry color="#4C0073" quantity="-34" />' + //R 76;G 0;B 115; darkpurple
  '<ColorMapEntry color="#4C0073" quantity="-35" />' +
  '<ColorMapEntry color="#4C0073" quantity="-36" />' +
  '<ColorMapEntry color="#4C0073" quantity="-37" />' +
  '<ColorMapEntry color="#8400A8" quantity="-38" />' + //R 132;G 0;B 168; purple
  '<ColorMapEntry color="#8400A8" quantity="-39" />' +
  '<ColorMapEntry color="#8400A8" quantity="-40" />' +
  '<ColorMapEntry color="#8400A8" quantity="-41" />' +
  '<ColorMapEntry color="#8400A8" quantity="-42" />' +
  '<ColorMapEntry color="#8400A8" quantity="-43" />' +
  '<ColorMapEntry color="#8400A8" quantity="-44" />' +
  '<ColorMapEntry color="#8400A8" quantity="-45" />' +
  '<ColorMapEntry color="#8400A8" quantity="-46" />' +
  '<ColorMapEntry color="#8400A8" quantity="-47" />' +
  '<ColorMapEntry color="#8400A8" quantity="-48" />' +
  '<ColorMapEntry color="#8400A8" quantity="-49" />' +
  '<ColorMapEntry color="#8400A8" quantity="-50" />' +
  '<ColorMapEntry color="#8400A8" quantity="-51" />' +
  '<ColorMapEntry color="#8400A8" quantity="-52" />' +
  '<ColorMapEntry color="#8400A8" quantity="-53" />' +
  '<ColorMapEntry color="#8400A8" quantity="-54" />' +
  '<ColorMapEntry color="#8400A8" quantity="-55" />' +
  '<ColorMapEntry color="#8400A8" quantity="-56" />' +
  '<ColorMapEntry color="#8400A8" quantity="-57" />' +
  '<ColorMapEntry color="#8400A8" quantity="-58" />' +
  '<ColorMapEntry color="#8400A8" quantity="-59" />' +
  '<ColorMapEntry color="#8400A8" quantity="-60" />' +
  '<ColorMapEntry color="#8400A8" quantity="-61" />' +
  '<ColorMapEntry color="#8400A8" quantity="-62" />' +
  '<ColorMapEntry color="#8400A8" quantity="-63" />' +
  '<ColorMapEntry color="#8400A8" quantity="-64" />' +
  '<ColorMapEntry color="#8400A8" quantity="-65" />' +
  '<ColorMapEntry color="#8400A8" quantity="-66" />' +
  '<ColorMapEntry color="#8400A8" quantity="-67" />' +
  '<ColorMapEntry color="#8400A8" quantity="-68" />' +
  '<ColorMapEntry color="#8400A8" quantity="-69" />' +
  '<ColorMapEntry color="#8400A8" quantity="-70" />' +
  '</ColorMap>' +
  '</RasterSymbolizer>';

var sld_intervals_percent_ndvi =
  '<RasterSymbolizer>' +
  '<ColorMap type="intervals" extended="false" >' +
  '<ColorMapEntry color="#000096" quantity="70" />' + //R 0;G 0 ;B 150; verydarkblue
  '<ColorMapEntry color="#000096" quantity="69" />' +
  '<ColorMapEntry color="#000096" quantity="68" />' +
  '<ColorMapEntry color="#000096" quantity="67" />' +
  '<ColorMapEntry color="#000096" quantity="66" />' +
  '<ColorMapEntry color="#000096" quantity="65" />' +
  '<ColorMapEntry color="#000096" quantity="64" />' +
  '<ColorMapEntry color="#000096" quantity="63" />' +
  '<ColorMapEntry color="#000096" quantity="62" />' +
  '<ColorMapEntry color="#000096" quantity="62" />' +
  '<ColorMapEntry color="#000096" quantity="61" />' +
  '<ColorMapEntry color="#000096" quantity="60" />' +
  '<ColorMapEntry color="#000096" quantity="59" />' +
  '<ColorMapEntry color="#000096" quantity="58" />' +
  '<ColorMapEntry color="#000096" quantity="57" />' +
  '<ColorMapEntry color="#000096" quantity="56" />' +
  '<ColorMapEntry color="#000096" quantity="55" />' +
  '<ColorMapEntry color="#000096" quantity="54" />' +
  '<ColorMapEntry color="#000096" quantity="53" />' +
  '<ColorMapEntry color="#000096" quantity="52" />' +
  '<ColorMapEntry color="#000096" quantity="52" />' +
  '<ColorMapEntry color="#000096" quantity="51" />' +
  '<ColorMapEntry color="#000096" quantity="50" />' +
  '<ColorMapEntry color="#000096" quantity="49" />' +
  '<ColorMapEntry color="#000096" quantity="48" />' +
  '<ColorMapEntry color="#000096" quantity="47" />' +
  '<ColorMapEntry color="#000096" quantity="46" />' +
  '<ColorMapEntry color="#000096" quantity="45" />' +
  '<ColorMapEntry color="#000096" quantity="44" />' +
  '<ColorMapEntry color="#000096" quantity="43" />' +
  '<ColorMapEntry color="#000096" quantity="42" />' +
  '<ColorMapEntry color="#000096" quantity="42" />' +
  '<ColorMapEntry color="#000096" quantity="41" />' +
  '<ColorMapEntry color="#000096" quantity="40" />' +
  '<ColorMapEntry color="#000096" quantity="39" />' +
  '<ColorMapEntry color="#000096" quantity="38" />' +
  '<ColorMapEntry color="#000096" quantity="37" />' +
  '<ColorMapEntry color="#000096" quantity="36" />' +
  '<ColorMapEntry color="#000096" quantity="35" />' +
  '<ColorMapEntry color="#000096" quantity="34" />' +
  '<ColorMapEntry color="#000096" quantity="33" />' +
  '<ColorMapEntry color="#000096" quantity="32" />' +
  '<ColorMapEntry color="#000096" quantity="31" />' +
  '<ColorMapEntry color="#000096" quantity="30" />' +
  '<ColorMapEntry color="#000096" quantity="29" />' +
  '<ColorMapEntry color="#000096" quantity="28" />' +
  '<ColorMapEntry color="#000096" quantity="27" />' +
  '<ColorMapEntry color="#000096" quantity="26" />' +
  '<ColorMapEntry color="#0000FF" quantity="25" />' + //R 0;G 0 ;B 255; darkblue
  '<ColorMapEntry color="#0000FF" quantity="24" />' +
  '<ColorMapEntry color="#0000FF" quantity="23" />' +
  '<ColorMapEntry color="#0000FF" quantity="22" />' +
  '<ColorMapEntry color="#0000FF" quantity="22" />' +
  '<ColorMapEntry color="#0000FF" quantity="21" />' +
  '<ColorMapEntry color="#0000FF" quantity="20" />' +
  '<ColorMapEntry color="#0000FF" quantity="19" />' +
  '<ColorMapEntry color="#0000FF" quantity="18" />' +
  '<ColorMapEntry color="#0000FF" quantity="17" />' +
  '<ColorMapEntry color="#0000FF" quantity="16" />' +
  '<ColorMapEntry color="#0000FF" quantity="15" />' +
  '<ColorMapEntry color="#0000FF" quantity="14" />' +
  '<ColorMapEntry color="#0000FF" quantity="13" />' +
  '<ColorMapEntry color="#0000FF" quantity="12" />' +
  '<ColorMapEntry color="#0000FF" quantity="11" />' +
  '<ColorMapEntry color="#0070FF" quantity="10" />' + //R 0;G 112 ;B 255; mediumblue
  '<ColorMapEntry color="#0070FF" quantity="09" />' +
  '<ColorMapEntry color="#0070FF" quantity="08" />' +
  '<ColorMapEntry color="#0070FF" quantity="07" />' +
  '<ColorMapEntry color="#0070FF" quantity="06" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="05" />' + //R 110;G 190 ;B 255; lightblue
  '<ColorMapEntry color="#6EBFFF" quantity="04" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="03" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="02" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="01" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="00" />' +
  '<ColorMapEntry color="#6EBFFF" quantity="-01" />' + //R 110;G 190 ;B 255; lightblue
  '<ColorMapEntry color="#6EBFFF" quantity="-02" />' + //R 110;G 190 ;B 255; lightblue
  '<ColorMapEntry color="#6EBFFF" quantity="-03" />' + //R 110;G 190 ;B 255; lightblue
  // '<ColorMapEntry color="#f3f6f4" quantity="-01" />' + //R 210;G 210;B 210; lightgrey
  // '<ColorMapEntry color="#f3f6f4" quantity="-02" />' + //R 210;G 210;B 210; lightgrey
  // '<ColorMapEntry color="#f3f6f4" quantity="-03" />' + //R 210;G 210;B 210; lightgrey

  '<ColorMapEntry color="#D2D2D2" quantity="-04" />' + //R 210;G 210;B 210; lightgrey
  '<ColorMapEntry color="#D2D2D2" quantity="-05" />' +
  '<ColorMapEntry color="#D2D2D2" quantity="-06" />' +
  '<ColorMapEntry color="#FFFFBE" quantity="-07" />' + //R 255;G 255;B 190; buffyellow
  '<ColorMapEntry color="#FFFFBE" quantity="-08" />' +
  '<ColorMapEntry color="#FFFFBE" quantity="-09" />' +
  '<ColorMapEntry color="#FFFF00" quantity="-10" />' + //R 255;G 255;B 0; brightyellow
  '<ColorMapEntry color="#FFFF00" quantity="-11" />' +
  '<ColorMapEntry color="#FFFF00" quantity="-12" />' +
  '<ColorMapEntry color="#FFD37F" quantity="-13" />' + //R 255;G 211;B 127; lightorange
  '<ColorMapEntry color="#FFD37F" quantity="-14" />' +
  '<ColorMapEntry color="#FFD37F" quantity="-15" />' +
  '<ColorMapEntry color="#FFAA00" quantity="-16" />' + //R 255;G 170;B 0; redorange
  '<ColorMapEntry color="#FFAA00" quantity="-17" />' +
  '<ColorMapEntry color="#FFAA00" quantity="-18" />' +
  '<ColorMapEntry color="#E64C00" quantity="-19" />' + //R 230;G 76;B 0; darkred
  '<ColorMapEntry color="#E64C00" quantity="-20" />' +
  '<ColorMapEntry color="#E64C00" quantity="-21" />' +
  '<ColorMapEntry color="#A80000" quantity="-22" />' + //R 168;G 0;B 0; verydarkred
  '<ColorMapEntry color="#A80000" quantity="-23" />' +
  '<ColorMapEntry color="#A80000" quantity="-24" />' +
  '<ColorMapEntry color="#A80000" quantity="-25" />' +
  '<ColorMapEntry color="#730000" quantity="-26" />' + //R 115;G 0;B 0; beet
  '<ColorMapEntry color="#730000" quantity="-27" />' +
  '<ColorMapEntry color="#730000" quantity="-28" />' +
  '<ColorMapEntry color="#730000" quantity="-29" />' +
  '<ColorMapEntry color="#343434" quantity="-30" />' + //R 52;G 52;B 52; slate
  '<ColorMapEntry color="#343434" quantity="-31" />' +
  '<ColorMapEntry color="#343434" quantity="-32" />' +
  '<ColorMapEntry color="#343434" quantity="-33" />' +
  '<ColorMapEntry color="#4C0073" quantity="-34" />' + //R 76;G 0;B 115; darkpurple
  '<ColorMapEntry color="#4C0073" quantity="-35" />' +
  '<ColorMapEntry color="#4C0073" quantity="-36" />' +
  '<ColorMapEntry color="#4C0073" quantity="-37" />' +
  '<ColorMapEntry color="#8400A8" quantity="-38" />' + //R 132;G 0;B 168; purple
  '<ColorMapEntry color="#8400A8" quantity="-39" />' +
  '<ColorMapEntry color="#8400A8" quantity="-40" />' +
  '<ColorMapEntry color="#8400A8" quantity="-41" />' +
  '<ColorMapEntry color="#8400A8" quantity="-42" />' +
  '<ColorMapEntry color="#8400A8" quantity="-43" />' +
  '<ColorMapEntry color="#8400A8" quantity="-44" />' +
  '<ColorMapEntry color="#8400A8" quantity="-45" />' +
  '<ColorMapEntry color="#8400A8" quantity="-46" />' +
  '<ColorMapEntry color="#8400A8" quantity="-47" />' +
  '<ColorMapEntry color="#8400A8" quantity="-48" />' +
  '<ColorMapEntry color="#8400A8" quantity="-49" />' +
  '<ColorMapEntry color="#8400A8" quantity="-50" />' +
  '<ColorMapEntry color="#8400A8" quantity="-51" />' +
  '<ColorMapEntry color="#8400A8" quantity="-52" />' +
  '<ColorMapEntry color="#8400A8" quantity="-53" />' +
  '<ColorMapEntry color="#8400A8" quantity="-54" />' +
  '<ColorMapEntry color="#8400A8" quantity="-55" />' +
  '<ColorMapEntry color="#8400A8" quantity="-56" />' +
  '<ColorMapEntry color="#8400A8" quantity="-57" />' +
  '<ColorMapEntry color="#8400A8" quantity="-58" />' +
  '<ColorMapEntry color="#8400A8" quantity="-59" />' +
  '<ColorMapEntry color="#8400A8" quantity="-60" />' +
  '<ColorMapEntry color="#8400A8" quantity="-61" />' +
  '<ColorMapEntry color="#8400A8" quantity="-62" />' +
  '<ColorMapEntry color="#8400A8" quantity="-63" />' +
  '<ColorMapEntry color="#8400A8" quantity="-64" />' +
  '<ColorMapEntry color="#8400A8" quantity="-65" />' +
  '<ColorMapEntry color="#8400A8" quantity="-66" />' +
  '<ColorMapEntry color="#8400A8" quantity="-67" />' +
  '<ColorMapEntry color="#8400A8" quantity="-68" />' +
  '<ColorMapEntry color="#8400A8" quantity="-69" />' +
  '<ColorMapEntry color="#8400A8" quantity="-70" />' +
  '</ColorMap>' +
  '</RasterSymbolizer>';

var index_sld_map = {
  ABSOLUTE_NDVI: sld_intervals_absolute_ndvi,
  PERCENT_NDVI: sld_intervals_percent_ndvi,
};

/////////////////////////////////////////////////////////////////
// END GLOBAL VARIABLES AND CONSTANTS
/////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////
// BEGIN HELPER FUNCTIONS
/////////////////////////////////////////////////////////////////

function removeLayerByName(name, map) {
  var m = map || Map;
  var layers = m.layers().getJsArray();
  var removedIndexes = [];
  for (var i in layers) {
    var lay = layers[i];
    var lay_name = lay.getName();
    if (lay_name === name) {
      var e;
      m.remove(lay);
      removedIndexes.push(Number(i));
    }
  }
  return removedIndexes;
}

function getLayer(name, map) {
  var m = map || Map;
  var layers = m.layers();
  var lay = null;
  var l = layers.length();
  for (var i=0; i<l; i++) {
    var layer = layers.get(i);
    var n = layer.getName();
    if (n === name) {
      lay = layer;
      break;
    }
  }
  return lay;
}

// Helper function for date check
function isValidDate(dateString) {
  var dateObject = new Date(dateString);
  return !isNaN(dateObject.getTime());
}

function checkIfDateOkay(startDate, endDate, selectedSatelliteProps) {
  var regex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
  var okay = true;
  var startDateMillis = ee.Date(startDate).millis();
  var endDateMillis = ee.Date(endDate).millis();
  var startOfDataMillis = ee.Date(selectedSatelliteProps.startDate).millis();
  var endofDataMillis = ee.Date(selectedSatelliteProps.endDate).millis();

  // check if date passed in is properly formatted
  if (!regex.test(startDate)) {
    print('start date is not properly formatted');
    okay = false;
  } else if (!regex.test(endDate)) {  // check if other date is properly formatted
    print('end date is not properly formatted');
    okay = false;
  } else if (!isValidDate(startDate)) {
    print('start date is not a valid calendar date');
    okay=false;
  } else if (!isValidDate(endDate)) { // check if the date is a real date
    print('end date is not a valid calendar date');
    okay=false;
  } else if (startDateMillis < startOfDataMillis) {  // check if the date passed in is less than the start of valid satellite data
    print('start date is less than start of valid satellite data');
    okay = false;
  } else if (startDateMillis > endofDataMillis) { // check if the date passed in is greater than end of valid satellite data
    print('start date is greater than end of valid satellite data');
    okay = false;
  } else if (endDateMillis < startOfDataMillis) { // check if other date is less than the start of valid satellite date
    print('end date is less than start of valid satellite data');
    okay = false;
  } else if (endDateMillis > endofDataMillis) { // check if other date is greater than the end of the valid satellite date
    print('end date is greater than end of valid satellite data');
    okay = false;
  } else if (startDateMillis >= endDateMillis) { // check if start date is greater than or equal to the end date
    print('start date is greater than end date.');
    okay = false;
  }
  return okay;
}

/////////////////////////////////////////////////////////////////
// END HELPER FUNCTIONS
/////////////////////////////////////////////////////////////////






/////////////////////////////////////////////////////////////////
// BEGIN USER INTERFACE AND ASSOCIATED FUNCTIONS
// EVERYTHING IN HERE IS GLOBALLY AVAILABLE
/////////////////////////////////////////////////////////////////

// Helper Function to easily create labels
var createNewLabel = function (value, stretch, textAlign, fontWeight, fontSize, margin) {
  return ui.Label({
    value: value,
    style: {
      stretch: stretch,
      textAlign: textAlign,
      fontWeight: fontWeight,
      fontSize: fontSize,
      margin: margin,
    },
  });
};

// Helper Function to easily create selectors
var createUISelect = function (items, placeholder, value, onChange, style, disabled) {
  return ui.Select({
    items: items,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    disabled: disabled,
    style: style,
  });
};

// Function to disable all widgets within a panel
function disablePanelWidgets(panel) {
  panel.widgets().forEach(function (widget) {
    if (widget.setDisabled) {
      widget.setDisabled(true);
    }
  });
}

// Function to enable all widgets within a panel
function enablePanelWidgets(panel) {
  panel.widgets().forEach(function (widget) {
    if (widget.setDisabled) {
      widget.setDisabled(false);
    }
  });
}

// create labels
var versionDateLabel = createNewLabel('ver. 05/20/2025', 'horizontal', 'left', 'bold', '10px', '8px 8px 8px 8px');
var title = createNewLabel('HiForm-2 Change Mapper', 'horizontal', 'left', 900, '18px', '8px 8px 8px 8px');
var satelliteLabel = createNewLabel('1. Choose Satellite', 'horizontal', 'left', 500, '16px', '12px 8px 0px 24px');
var cloudThresholdLabel = createNewLabel('2. Choose Cloud Threshold', 'horizontal', 'left', 500, '16px', '12px 8px 0px 24px');
var validDateRange = createNewLabel(
  'Start Date: ' + SATELLITE_PROPERTIES[defaultSatellite].startDate,
  'horizontal',
  'left',
  500,
  '14px',
  '0 8px 12px 64px'
);
var dateSelectLabel = createNewLabel('3. Set Dates', 'horizontal', 'left', 500, '16px', '12px 8px 0px 24px');
var preDisturbanceLabel = createNewLabel(
  'Pre-disturbance range',
  'horizontal',
  'left',
  500,
  '14px',
  '3px 8px 0 64px'
);
var postDisturbanceLabel = createNewLabel(
  'Post-disturbance range',
  'horizontal',
  'left',
  500,
  '14px',
  '8px 8px 0 64px'
);
var explorationLabel = createNewLabel('4. Explore', 'horizontal', 'left', 500, '16px', '8px 8px 0 24px');
var shareExportLabel = createNewLabel('5. Share/Export', 'horizontal', 'left', 500, '16px', '8px 8px 0 24px');
// end label creation

// Create satellite UI selector.
var satelliteSelectOnChange = function (newValue) {
  validDateRange.setValue('Start Date: ' + SATELLITE_PROPERTIES[newValue].startDate); // set new dates
  inspectorLabel.setValue(inspectorLabelDefaultMsg); // refresh inspector to default state
  if (newValue === "Sentinel 3 TOA" || newValue === "L5/L8 SR Combined" || newValue === "L5/L8 TOA Combined" || newValue === "L8/L9 SR Combined" || newValue === "L8/L9 TOA Combined" || newValue === "L8/L9 Real-Time Combined") {
    thresholdSelector.setDisabled(true);
    exportCloudMaskButton.setDisabled(true);
  } else {
    thresholdSelector.setDisabled(false);
    exportCloudMaskButton.setDisabled(false);
  }
};

var satelliteNames = ee
  .Dictionary(SATELLITE_PROPERTIES)
  .keys()
  .sort()
  .getInfo();


var satelliteSelector = createUISelect(
  satelliteNames,
  defaultSatellite,
  defaultSatellite,
  satelliteSelectOnChange,
  { textAlign: 'left', minWidth: '150px', margin: '3px 8px 3px 64px' },
  false
);

// cloud threshold selector

var thresholdSelectOnChange = function (threshold) {
  if (threshold === 'Less') {
    CLOUD_THRESHOLD = 0.6;
  } else if (threshold === 'Moderate') {
    CLOUD_THRESHOLD = 0.725;
  } else if (threshold === 'More') {
    CLOUD_THRESHOLD = 0.85;
  }
};

var thresholdSelector = createUISelect(
  ['Less', 'Moderate', 'More'],
  'Moderate',
  'Moderate',
  thresholdSelectOnChange,
  { textAlign: 'left', minWidth: '150px', margin: '3px 8px 3px 64px' },
  false
);

// Track date error state
var dateErrorLabel = ui.Label({
  value: 'Cannot do analysis, please fix dates!',
  style: {
    // stretch: 'horizontal',
    textAlign: 'center',
    fontWeight: 500,
    fontSize: '10px',
    color: 'red',
    margin: '3px 8px 0 64px',
  },
});

var dateErrorState = [false, false];
var disableSubmitOnDateError = function (dateErrorState) {
  if (
    dateErrorState.some(function (value) {
      return value === true;
    })
  ) {
    var isAlreadyError = submitPanel.widgets().indexOf(dateErrorLabel) !== -1;
    if (!isAlreadyError) {
      submitPanel.insert(0, dateErrorLabel);
    }
    submit.setDisabled(true);
  } else {
    submitPanel.remove(dateErrorLabel);
    submit.setDisabled(false);
  }
};

// Create pre-disturbance date selection boxes.
var preDisturbanceStartDate = ui.url.get('preDisturbanceStartDate', currentDate.advance(-1, 'year').advance(-14, 'day').format('yyyy-MM-dd').getInfo());
var preDisturbanceEndDate = ui.url.get('preDisturbanceEndDate', currentDate.advance(-1, 'year').format('yyyy-MM-dd').getInfo());
var dateFilterPreDateStart = ui.Textbox({
  placeholder: 'YYYY-MM-DD',
  value: preDisturbanceStartDate,
  onChange: function () {
    var startValue = dateFilterPreDateStart.getValue();
    var endValue = dateFilterPreDateEnd.getValue();
    var props = SATELLITE_PROPERTIES[satelliteSelector.getValue()];

    var okay = checkIfDateOkay(startValue, endValue, props);
    if (!okay) {
      // set to red if the date does not come back okay
      dateErrorState[0] = true;
      dateFilterPreDateStart.style().set('color', 'red');
    } else {
      // otherwise set both start and end date to black
      dateFilterPreDateStart.style().set('color', 'black');
      dateFilterPreDateEnd.style().set('color', 'black');
      dateErrorState[0] = false;
    }
    disableSubmitOnDateError(dateErrorState);
  },
  style: {
    margin: '0 8px 1px 64px',
  },
});
var dateFilterPreDateEnd = ui.Textbox({
  placeholder: 'YYYY-MM-DD',
  value: preDisturbanceEndDate,
  onChange: function () {
    var startValue = dateFilterPreDateStart.getValue();
    var endValue = dateFilterPreDateEnd.getValue();
    var props = SATELLITE_PROPERTIES[satelliteSelector.getValue()];

    var okay = checkIfDateOkay(startValue, endValue, props);
    if (!okay) {
      // set to red if the date does not come back okay
      dateFilterPreDateEnd.style().set('color', 'red');
      dateErrorState[0] = true;
    } else {
      // otherwise set both start and end date to black
      dateFilterPreDateStart.style().set('color', 'black');
      dateFilterPreDateEnd.style().set('color', 'black');
      dateErrorState[0] = false;
    }
    disableSubmitOnDateError(dateErrorState);
  },
  style: {
    margin: '1px 8px 1px 64px',
  },
});

// Create post-disturbance date selection boxes.
var postDisturbanceStartDate = ui.url.get('postDisturbanceStartDate', currentDate.advance(-14, 'day').format('yyyy-MM-dd').getInfo());
var postDisturbanceEndDate = ui.url.get('postDisturbanceEndDate', currentDateString);
var dateFilterPostDateStart = ui.Textbox({
  placeholder: 'YYYY-MM-DD',
  value: postDisturbanceStartDate,
  onChange: function () {
    var startValue = dateFilterPostDateStart.getValue();
    var endValue = dateFilterPostDateEnd.getValue();
    var props = SATELLITE_PROPERTIES[satelliteSelector.getValue()];

    var okay = checkIfDateOkay(startValue, endValue, props);
    if (!okay) {
      // set to red if the date does not come back okay
      dateFilterPostDateStart.style().set('color', 'red');
      dateErrorState[1] = true;
    } else {
      // otherwise set both start and end date to black
      dateFilterPostDateStart.style().set('color', 'black');
      dateFilterPostDateEnd.style().set('color', 'black');
      dateErrorState[1] = false;
    }
    disableSubmitOnDateError(dateErrorState);
  },
  style: {
    margin: '0 8px 1px 64px',
  },
});
var dateFilterPostDateEnd = ui.Textbox({
  placeholder: 'YYYY-MM-DD',
  value: postDisturbanceEndDate,
  onChange: function () {
    var startValue = dateFilterPostDateStart.getValue();
    var endValue = dateFilterPostDateEnd.getValue();
    var props = SATELLITE_PROPERTIES[satelliteSelector.getValue()];

    var okay = checkIfDateOkay(startValue, endValue, props);
    if (!okay) {
      // set to red if the date does not come back okay
      dateFilterPostDateEnd.style().set('color', 'red');
      dateErrorState[1] = true;
    } else {
      // otherwise set both start and end date to black
      dateFilterPostDateStart.style().set('color', 'black');
      dateFilterPostDateEnd.style().set('color', 'black');
      dateErrorState[1] = false;
    }
    disableSubmitOnDateError(dateErrorState);
  },
  style: {
    margin: '1px 8px 12px 64px',
  },
});

function disableSubmit() {
  submit.setDisabled(true);
  disablePanelWidgets(leftPanel);
  submit.setLabel('Awaiting results...');
}

function enableSubmit(override) {
  if (override !== true && submitCounter < 1) {
    submitCounter += 1;
  } else {
    submit.setLabel('Do the change analysis');
    enablePanelWidgets(leftPanel);
    submit.setDisabled(false);
    submitCounter = 0;
  }
}

// ERROR HANDLING STUFF
var errorLabel = ui.Label('No pre or post image is available. Change your dates and try again.', { color: 'red' });
var closeButton = ui.Button({
  label: 'Okay',
  onClick: function () {
    enableSubmit(true);
    errorPanel.style().set('shown', false);
  },
});
var errorPanel = ui.Panel({
  widgets: [errorLabel, closeButton],
  style: { position: 'middle-left', width: '250px', shown: false },
});
map.add(errorPanel);

// END ERROR HANDLING

var submit = ui.Button({
  label: 'Do the change analysis',
  onClick: function () {
    if (sentinel3ZoomListener) {
      map.unlisten(sentinel3ZoomListener);
    }
    layerReadyCounter = 0;
    var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
    if (satelliteSelector.getValue() === "Sentinel 3 TOA") {
      submitSentinel3ChangeAnalysis(satelliteProps);
    } else {
      submitChangeAnalysis(satelliteProps);
      submit.setDisabled(true);
      disableSubmit();
    }
  },
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var submitCheckbox = ui.Checkbox({
  label: '%',
  value: changeType === 'PERCENT_NDVI' ? true : false,
  onChange: function() {
    if (changeType === 'ABSOLUTE_NDVI') {
      changeType = 'PERCENT_NDVI';
    } else {
      changeType = 'ABSOLUTE_NDVI';
    }
  }
});

var submitInnerPanel = ui.Panel({
  widgets: [submit, submitCheckbox],
  layout: ui.Panel.Layout.flow('horizontal'),
});

var submitPanel = ui.Panel({
  widgets: [submitInnerPanel],
  layout: ui.Panel.Layout.flow('vertical'),
});

// Create selector for exporting image
var exportImageSelector = createUISelect(
  ['NDVI', 'Post True Color'],
  'NDVI',
  'NDVI',
  function () {
    print('I changed!');
  },
  { textAlign: 'left', minWidth: '150px', margin: '3px 8px 3px 64px' },
  false
);

//////////////////////////////////////////
// EXPORT FUNCTIONS
//////////////////////////////////////////

var exportNDVIImageToGoogleDrive = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);
  var tid = ee.data.newTaskId();
  //var waterMask = NLCDWaterMask();

  var imageToExport = ndviChangeProduct;

  var full_config = {
    crs: 'EPSG:4326', // for now wgs84
    element: imageToExport, // exporting an image
    type: 'EXPORT_IMAGE',
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'forest_change_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    driveFileNamePrefix: 'forest_change_export' + rundate, // This is file name I always date stamp stuff so it can't overwrite
    driveFolder: 'earth_engine_exports', // this is google drive folder
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  };
  var msg = ee.data.startProcessing(tid, full_config); // this actually runs the export it sill asks the user if its okay to do this.
};

var exportNDVIImageToGoogleCloud = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);
  //var waterMask = NLCDWaterMask();

  var imageToExport = ndviChangeProduct;

  Export.image.toCloudStorage({
    crs: 'EPSG:4326', // for now wgs84
    image: imageToExport, // exporting an image
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'forest_change_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    bucket: 'earth_engine_exports',
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  });
};

var exportNDVIImageToGoogleDriveBill = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);
  var tid = ee.data.newTaskId();
  var forestMask = NLCDForestMask(exportImageGeometry);

  print('bill drive');
  var imageToExport = ndviChangeProduct.sldStyle(sld_intervals_absolute_ndvi).mask(forestMask);

  var full_config = {
    crs: 'EPSG:4326', // for now wgs84
    element: imageToExport, // exporting an image
    type: 'EXPORT_IMAGE',
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'forest_change_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    driveFileNamePrefix: 'forest_change_export' + rundate, // This is file name I always date stamp stuff so it can't overwrite
    driveFolder: 'earth_engine_exports', // this is google drive folder
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  };
  var msg = ee.data.startProcessing(tid, full_config); // this actually runs the export it sill asks the user if its okay to do this.
};

var exportNDVIImageToGoogleCloudBill = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);
  var forestMask = NLCDForestMask(exportImageGeometry);

  print('bill cloud');
  var imageToExport = ndviChangeProduct.sldStyle(sld_intervals_absolute_ndvi).mask(forestMask);

  Export.image.toCloudStorage({
    crs: 'EPSG:4326', // for now wgs84
    image: imageToExport, // exporting an image
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'forest_change_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    bucket: 'earth_engine_exports',
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  });
};

var exportCloudMaskToGoogleDrive = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);
  var tid = ee.data.newTaskId();

  var imageToExport = combinedCloudMask.selfMask();

  var full_config = {
    crs: 'EPSG:4326', // for now wgs84
    element: imageToExport, // exporting an image
    type: 'EXPORT_IMAGE',
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'cloud_mask_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    driveFileNamePrefix: 'cloud_mask_export' + rundate, // This is file name I always date stamp stuff so it can't overwrite
    driveFolder: 'earth_engine_exports', // this is google drive folder
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  };
  var msg = ee.data.startProcessing(tid, full_config); // this actually runs the export it sill asks the user if its okay to do this.
};

var exportCloudMaskToGoogleCloud = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);

  var imageToExport = combinedCloudMask.selfMask();

  Export.image.toCloudStorage({
    crs: 'EPSG:4326', // for now wgs84
    image: imageToExport, // exporting an image
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'cloud_mask_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    bucket: 'earth_engine_exports',
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  });
};

var exportPTCImageToGoogleDrive = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);
  exportImageGeometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale());
  var tid = ee.data.newTaskId();

  var imageToExport = postImageGreenestClip.select([
    satelliteProps.bands.red,
    satelliteProps.bands.green,
    satelliteProps.bands.blue,
  ]);

  var full_config = {
    crs: 'EPSG:4326', // for now wgs84
    element: imageToExport, // exporting an image
    type: 'EXPORT_IMAGE',
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'post_true_color_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    driveFileNamePrefix: 'post_true_color_export' + rundate, // This is file name I always date stamp stuff so it can't overwrite
    driveFolder: 'earth_engine_exports', // this is google drive folder
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  };
  var msg = ee.data.startProcessing(tid, full_config); // this actually runs the export it sill asks the user if its okay to do this.
};

var exportPTCImageToGoogleCloud = function () {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var todaysDate = new Date();
  var yyyy = todaysDate.getFullYear().toString();
  var mm = (todaysDate.getMonth() + 1).toString();
  var dd = todaysDate.getDate().toString();
  var hours = todaysDate.getHours().toString();
  var minutes = todaysDate.getMinutes().toString();
  var seconds = todaysDate.getSeconds().toString();
  var rundate =
    '_' +
    yyyy +
    (mm.split('').length === 1 ? '0' + mm : mm) +
    (dd.split('').length === 1 ? '0' + dd : dd) +
    '_' +
    (hours.split('').length === 1 ? '0' + hours : hours) +
    '_' +
    (minutes.split('').length === 1 ? '0' + minutes : minutes) +
    '_' +
    (seconds.split('').length === 1 ? '0' + seconds : seconds);

  var imageToExport = postImageGreenestClip.select([
    satelliteProps.bands.red,
    satelliteProps.bands.green,
    satelliteProps.bands.blue,
  ]);

  Export.image.toCloudStorage({
    crs: 'EPSG:4326', // for now wgs84
    image: imageToExport, // exporting an image
    fileFormat: 'GEO_TIFF', // geotiff format
    description: 'post_true_color_export' + rundate, // I always date stamp stuff so it can't overwrite
    region: exportImageGeometry,
    bucket: 'earth_engine_exports',
    maxPixels: 10000000000000,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale, // this maybe 10, 15, 30, 250 depending on sat. platform sentinel, landsat, or modis
  });
};

var splitGeometries = function (fc) {
  // Separate points and polygons to create separate shapefiles when both present
  var polygons = ee.List([]);
  var points = ee.List([]);

  if (fc.size().getInfo() > 0) {
    var features = fc.toList(fc.size());

    polygons = features
      .map(function (f) {
        return ee.Feature(f).set('geometry_type', ee.Feature(f).geometry().type());
      })
      .filter(ee.Filter.equals('geometry_type', 'Polygon'));
    points = features
      .map(function (f) {
        return ee.Feature(f).set('geometry_type', ee.Feature(f).geometry().type());
      })
      .filter(ee.Filter.equals('geometry_type', 'Point'));
  }

  return { polygons: polygons, points: points };
};

var exportShapefilesToGoogleCloud = function () {
  var featureCollection = drawingTools.toFeatureCollection();
  var features = splitGeometries(featureCollection);
  var polygons = features.polygons;
  var points = features.points;

  // generate file name
  var now = new Date();
  var year = now.getUTCFullYear();
  var month = ('0' + (now.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + now.getUTCDate()).slice(-2);
  var hours = ('0' + now.getUTCHours()).slice(-2);
  var minutes = ('0' + now.getUTCMinutes()).slice(-2);
  var seconds = ('0' + now.getUTCSeconds()).slice(-2);
  var timestamp = year + month + day + '_' + hours + minutes + seconds;
  var polygonFileName = 'polygon_shapefile_' + timestamp;
  var pointFileName = 'point_shapefile_' + timestamp;

  polygons.length().evaluate(function (polyCount) {
    var hasPolygons = polyCount > 0;
    if (hasPolygons) {
      print('Generating Polygons Export Task...');
      var polygonTask = Export.table.toCloudStorage({
        collection: ee.FeatureCollection(polygons),
        description: polygonFileName,
        bucket: 'earth_engine_exports',
        fileFormat: 'SHP',
      });
    }
  });

  points.length().evaluate(function (pointCount) {
    var hasPoints = pointCount > 0;
    if (hasPoints) {
      print('Generating Points Export Task...');
      var pointTask = Export.table.toCloudStorage({
        collection: ee.FeatureCollection(points),
        description: pointFileName,
        bucket: 'earth_engine_exports',
        fileFormat: 'SHP',
      });
    }
  });
};

var exportShapefilesToGoogleDrive = function () {
  var featureCollection = drawingTools.toFeatureCollection();
  var features = splitGeometries(featureCollection);
  var polygons = features.polygons;
  var points = features.points;

  // generate file name
  var now = new Date();
  var year = now.getUTCFullYear();
  var month = ('0' + (now.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + now.getUTCDate()).slice(-2);
  var hours = ('0' + now.getUTCHours()).slice(-2);
  var minutes = ('0' + now.getUTCMinutes()).slice(-2);
  var seconds = ('0' + now.getUTCSeconds()).slice(-2);
  var timestamp = year + month + day + '_' + hours + minutes + seconds;
  var polygonFileName = 'polygon_shapefile_' + timestamp;
  var pointFileName = 'point_shapefile_' + timestamp;

  polygons.length().evaluate(function (polyCount) {
    var hasPolygons = polyCount > 0;
    if (hasPolygons) {
      print('Generating Polygons Export Task...');
      var polygonTask = Export.table.toDrive({
        collection: ee.FeatureCollection(polygons),
        description: polygonFileName,
        folder: 'earth_engine_exports',
        fileFormat: 'SHP',
      });
    }
  });
  points.length().evaluate(function (pointCount) {
    var hasPoints = pointCount > 0;
    if (hasPoints) {
      print('Generating Points Export Task...');
      var pointTask = Export.table.toDrive({
        collection: ee.FeatureCollection(points),
        description: pointFileName,
        folder: 'earth_engine_exports',
        fileFormat: 'SHP',
      });
    }
  });
};

//////////////////////////////////////////
// EXPORT BUTTONS
//////////////////////////////////////////

var userFunctions = {
  NonFS: {
    exportShapefiles: exportShapefilesToGoogleDrive,
    ExportNDVI: exportNDVIImageToGoogleDrive,
    ExportNDVIBill: exportNDVIImageToGoogleDriveBill,
    ExportPTC: exportPTCImageToGoogleDrive,
    ExportCloud: exportCloudMaskToGoogleDrive
  },
  FS: {
    exportShapefiles: exportShapefilesToGoogleCloud,
    ExportNDVI: exportNDVIImageToGoogleCloud,
    ExportNDVIBill: exportNDVIImageToGoogleCloudBill,
    ExportPTC: exportPTCImageToGoogleCloud,
    ExportCloud: exportCloudMaskToGoogleCloud
  },
};

// THIS IS THE TOGGLE POINT FOR FS vs NON FS Users
var exportFunctions = userFunctions[user];

var exportNDVIImageButton = ui.Button({
  label: 'Export all-lands change values',
  onClick: exportFunctions.ExportNDVI,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

// This button has been added to allow Bill C to export 3-band rgb sld masked forest change products
var exportNDVIImageButtonBill = ui.Button({
  label: 'Export forest change geo-RGB',
  onClick: exportFunctions.ExportNDVIBill,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var exportPTCImageButton = ui.Button({
  label: 'Export post true color',
  onClick: exportFunctions.ExportPTC,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var exportCloudMaskButton = ui.Button({
  label: 'Export cloud mask',
  onClick: exportFunctions.ExportCloud,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

// Button for export Polygon
var exportShapefilesButton = ui.Button({
  label: 'Export drawn polygon(s)',
  // onClick: exportShapefilesToGoogleCloud,
  onClick: exportFunctions.exportShapefiles,
  style: {
    minWidth: '150px',
    margin: '3px 8px 12px 64px',
  },
});

// Button for generating a URL
var generateURLButton = ui.Button({
  label: 'Update URL for sharing',
  onClick: function () {
    ui.url.set('satellite', satelliteSelector.getValue());
    ui.url.set('preDisturbanceStartDate', dateFilterPreDateStart.getValue());
    ui.url.set('preDisturbanceEndDate', dateFilterPreDateEnd.getValue());
    ui.url.set('postDisturbanceStartDate', dateFilterPostDateStart.getValue());
    ui.url.set('postDisturbanceEndDate', dateFilterPostDateEnd.getValue());
    var coordinates = map.getCenter().coordinates().getInfo();
    var lng = coordinates[0];
    var lat = coordinates[1];
    ui.url.set('lng', lng);
    ui.url.set('lat', lat);
    ui.url.set('mapZoom', map.getZoom());
    ui.url.set('changeType', changeType);
    ui.url.set('autoRun', true);
    generatedURL.setUrl(
      'https://code.earthengine.google.com/' +
      // + ui.url.get('hexCode')
      '?hideCode=true' +
      '#satellite=' +
      ui.url.get('satellite') +
      ';' +
      'preDisturbanceStartDate=' +
      ui.url.get('preDisturbanceStartDate') +
      ';' +
      'preDisturbanceEndDate=' +
      ui.url.get('preDisturbanceEndDate') +
      ';' +
      'postDisturbanceStartDate=' +
      ui.url.get('postDisturbanceStartDate') +
      ';' +
      'postDisturbanceEndDate=' +
      ui.url.get('postDisturbanceEndDate') +
      ';' +
      'lng=' +
      ui.url.get('lng') +
      ';' +
      'lat=' +
      ui.url.get('lat') +
      ';' +
      'mapZoom=' +
      ui.url.get('mapZoom') +
      ';' +
      'changeType=' +
      ui.url.get('changeType') +
      ';' +
      'autoRun=' +
      ui.url.get('autoRun') +
      ';'
    );
    // + 'hexCode=' + ui.url.get('hexCode') + ';');
    generatedURL.style().set('shown', true);
  },
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var generatedURL = ui.Label({
  value: 'Generated URL',
  style: { shown: false },
});

// Panel Button to open/close panel
var panelButton = ui.Button({
  label: 'Close Panel',
  onClick: function () {
    // Open or close the panel.
    leftPanel.style().set('shown', false);
    openButton.style().set('shown', true);
  },
  style: {
    position: 'top-left',
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var openButton = ui.Button({
  label: 'Open Panel',
  onClick: function () {
    leftPanel.style().set('shown', true);
    openButton.style().set('shown', false);
  },
  style: {
    shown: false,
    margin: '13px 8px 8px -46px',
    position: 'top-left',
  },
});

var dateSelectPanel = ui.Panel({
  widgets: [
    preDisturbanceLabel,
    dateFilterPreDateStart,
    dateFilterPreDateEnd,
    postDisturbanceLabel,
    dateFilterPostDateStart,
    dateFilterPostDateEnd,
  ],
  style: {
    shown: false,
    position: 'middle-left',
  },
});

// Create Legend Panel
var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    shown: false,
    padding: '5px 8px',
  },
});

// Create Legend Title
var legendTitle = ui.Label({
  value: 'NDVI Change',
  style: {
    fontWeight: 'bold',
    fontSize: '14.5px',
    margin: '0 0 4px 0',
    padding: '0',
  },
});

var legendButton = ui.Button({
  label: 'Show/Hide Legend',
  onClick: function () {
    // Open or close the panel.
    if (legend.style().get('shown') === true) {
      legend.style().set('shown', false);
    } else {
      legend.style().set('shown', true);
    }
  },
  style: {
    position: 'top-left',
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

// Add the title to the panel
legend.add(legendTitle);

// Creates and styles 1 row of the legend.
var makeRow = function (name, color) {
  // Create the label that is actually the colored box.
  var colorBox = ui.Label({
    style: {
      backgroundColor: '#' + color,
      // Use padding to give the box height and width.
      padding: '8px',
      margin: '0 0 4px 0',
    },
  });

  // Create the label filled with the description text.
  var description = ui.Label({
    value: name,
    style: { margin: '0 0 4px 6px' },
  });

  // return the panel
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal'),
  });
};

/////////////////////////////////////////////////

for (var legendKey in absoluteLegendPallete) {
  var color = absoluteLegendPallete[legendKey];
  legend.add(makeRow(legendKey, color));
}

// Create an inspector label
var inspectorLabel = ui.Label({
  value: inspectorLabelDefaultMsg,
  style: {
    textAlign: 'left',
    fontSize: '11.5px',
    backgroundColor: '#f5f5f5',
    whiteSpace: 'pre',
  },
});

// Create an inspector panel and add it to the map.
var inspector = ui.Panel({
  widgets: [inspectorLabel],
  style: {
    textAlign: 'left',
    minWidth: '150px',
    maxWidth: '150px',
    margin: '3px 8px 3px 64px',
    border: '1px solid rgba(0,0,0,0.1)',
    backgroundColor: '#f5f5f5',
  },
});

// Create main UI panel on the left.
var leftPanel = ui.Panel({
  widgets: [
    title,
    satelliteLabel,
    satelliteSelector,
    validDateRange,
    cloudThresholdLabel,
    thresholdSelector,
    dateSelectLabel,
    preDisturbanceLabel,
    dateFilterPreDateStart,
    dateFilterPreDateEnd,
    postDisturbanceLabel,
    dateFilterPostDateStart,
    dateFilterPostDateEnd,
    explorationLabel,
    submitPanel,
    inspector,
    legendButton,
    shareExportLabel,
    generateURLButton,
    exportNDVIImageButton,
    exportNDVIImageButtonBill, // This is the rgb ndvi export button
    exportPTCImageButton,
    exportCloudMaskButton,
    exportShapefilesButton,
    // panelButton, // Commenting out for now
    versionDateLabel,
  ],
  style: {
    width: '280px',
    position: 'top-left',
  },
});


/////////////////////////////////////////////////////////////////
// END USER INTERFACE AND ASSOCIATED FUNCTIONS
/////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////
// BEGIN MAP FUNCTIONS
/////////////////////////////////////////////////////////////////

// attach openButton to the map
map.widgets().insert(1, openButton);

map.onClick(function (coords) {
  if (!ndviChangeProduct) {
    inspectorLabel.setValue('ERROR: Do change \nanalysis before using');
    return;
  }

  inspectorLabel.setValue('Loading...');
  // min max stuff can maybe remove when done
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
  var postStart = ee.Date(dateFilterPostDateStart.getValue());
  var postEnd = ee.Date(dateFilterPostDateEnd.getValue());
  var geometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale());

  var click_point = ee.Geometry.Point(coords.lon, coords.lat);
  var preDate = preImageGreenestClip
    .select('date')
    .reduceRegions(click_point, ee.Reducer.first(), satelliteProps.scale)
    .first()
    .get('first');
  var postDate = postImageGreenestClip
    .select('date')
    .reduceRegions(click_point, ee.Reducer.first(), satelliteProps.scale)
    .first()
    .get('first');
  var preNDVI = preImageGreenestClip
    .select('NDVI')
    .multiply(100)
    .reduceRegions(click_point, ee.Reducer.first(), satelliteProps.scale)
    .first()
    .get('first');
  var deltaNDVI = ndviChangeProduct
    .select('NDVI')
    .reduceRegions(click_point, ee.Reducer.first(), satelliteProps.scale)
    .first()
    .get('first');

  ee.Dictionary({
    preDate: preDate,
    postDate: postDate,
    preNDVI: preNDVI,
    deltaNDVI: deltaNDVI,
  }).evaluate(function (params) {
    inspectorLabel.setValue(
      'pre date: ' +
      params.preDate +
      '\npost date: ' +
      params.postDate +
      '\npre-NDVI: ' +
      params.preNDVI.toFixed(2) +
      '\ndelta-NDVI: ' +
      params.deltaNDVI.toFixed(2)
    );
  });
});

/////////////////////////////////////////////////////////////////
// END MAP FUNCTIONS
/////////////////////////////////////////////////////////////////




/////////////////////////////////////////////////////////////////
// BEGIN MAIN LOGIC FOR CHANGE ANALYSIS
/////////////////////////////////////////////////////////////////

// Function to add layers to map in correct order
var addLayersToMap = function() {
  if (layerReadyCounter < 1) { // Needs to be 2 for both pre and post true color
    layerReadyCounter += 1;
    return;
  }

  // remove old layers
  map.layers().reset();
  // add layers in correct order once pre and post true color have finished
  map.addLayer(postImageGreenestClip.select('date').randomVisualizer(), {}, 'Post Date Used', false);
  map.addLayer(preImageGreenestClip.select('date').randomVisualizer(), {}, 'Pre Date Used', false);
  map.add(postTrueColorLayer);
  map.add(preTrueColorLayer);

  map.addLayer(ndviChangeAllLandsLayer, {}, 'NDVI change - all lands', false);
  // map.addLayer(ndviChangeNoWaterLayer,  {}, 'NDVI change - no water', false);
  map.addLayer(ndviChangeDeciduousLayer, {}, 'NDVI change - deciduous forest only', false);
  map.addLayer(ndviChangeEvergreenLayer, {}, 'NDVI change - evergreen forest only', false);
  map.addLayer(ndviChangeForestOnlyLayer, {}, 'NDVI change - forest only', true);
  if (satelliteSelector.getValue() === "Sentinel 2 TOA" || satelliteSelector.getValue() === "Sentinel 2 SR") {
    map.addLayer(combinedCloudMask.selfMask(), {palette: ['000000']}, 'Combined Cloud Mask', false);
  }
  addHillshade(exportImageGeometry); // draw the hillshade
  addBoundaries(); // redraw the app boundaries
};


// A distinct sentinel 3 workflow that flows better
// TODO: Make distinct sentinel 2 and landsat workflows
var submitSentinel3ChangeAnalysis = function (satelliteProps) {
  map.layers().reset();
  // make global layers null
  ndviChangeForestOnlyLayer = null;
  ndviChangeEvergreenLayer = null;
  ndviChangeDeciduousLayer = null;
  ndviChangeAllLandsLayer = null;
  ndviChangeNoWaterLayer = null;
  preImageGreenestClip = null;
  postImageGreenestClip = null;
  preTrueColorLayer = null;
  postTrueColorLayer = null;
  ndviChangeProduct = null;
  combinedCloudMask = null;

  // update geometry with map extent at time of analysis
  exportImageGeometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale());

  // set inspector label back to default value
  inspectorLabel.setValue(inspectorLabelDefaultMsg);

  var preStart = ee.Date(dateFilterPreDateStart.getValue());
  var preEnd = ee.Date(dateFilterPreDateEnd.getValue());
  var postStart = ee.Date(dateFilterPostDateStart.getValue());
  var postEnd = ee.Date(dateFilterPostDateEnd.getValue());
  var geometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale());
  preImageGreenestClip = disturbance(satelliteProps, 'NDVI', preStart, preEnd, geometry);
  postImageGreenestClip = disturbance(satelliteProps, 'NDVI', postStart, postEnd, geometry);

  var forestMask = NLCDForestMask(geometry);
  var deciduousMask = NLCDDeciduousMask(geometry);
  var evergreenMask = NLCDEvergreenMask(geometry);
  var waterMask = NLCDWaterMask();
  var postMINUSpre, absNDVIc, absNDVIc_x100;

  if (submitCheckbox.getValue() === true) {
    changeType = 'PERCENT_NDVI';
  }

  if (changeType === 'ABSOLUTE_NDVI') {
    postMINUSpre = postImageGreenestClip.subtract(preImageGreenestClip);
    // rescale to signed integer 8bit (-127 - 127) to reduce file size
    absNDVIc = postMINUSpre.select('NDVI');
    absNDVIc_x100 = absNDVIc.multiply(100);
    ndviChangeProduct = absNDVIc_x100.int8();
  } else {
    // assumed to be 'PERCENT_NDVI'
    postMINUSpre = postImageGreenestClip.subtract(preImageGreenestClip).divide(preImageGreenestClip);
    // rescale to signed integer 8bit (-127 - 127) to reduce file size
    absNDVIc = postMINUSpre.select('NDVI');
    absNDVIc_x100 = absNDVIc.multiply(100);
    ndviChangeProduct = absNDVIc_x100.int8();
  }

  ndviChangeAllLandsLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(waterMask).clip(geometry);
  ndviChangeNoWaterLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(waterMask).clip(geometry);
  ndviChangeDeciduousLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(deciduousMask).clip(geometry);
  ndviChangeEvergreenLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(evergreenMask).clip(geometry);

  map.addLayer(postImageGreenestClip.select('date').randomVisualizer(), {}, 'Post Date Used', false);
  map.addLayer(preImageGreenestClip.select('date').randomVisualizer(), {}, 'Pre Date Used', false);

  postTrueColorLayer = ui.Map.Layer({
    eeObject: postImageGreenestClip,
    visParams: {
      bands: [satelliteProps.bands.red, satelliteProps.bands.green, satelliteProps.bands.blue],
      min: satelliteProps.min,
      max: satelliteProps.max,
      gamma: satelliteProps.gamma
    },
    name: "Post True Color",
    shown: false
  });
  map.add(postTrueColorLayer);
  preTrueColorLayer = ui.Map.Layer({
    eeObject: preImageGreenestClip,
    visParams: {
      bands: [satelliteProps.bands.red, satelliteProps.bands.green, satelliteProps.bands.blue],
      min: satelliteProps.min,
      max: satelliteProps.max,
      gamma: satelliteProps.gamma
    },
    name: "Pre True Color",
    shown: false
  });
  map.add(preTrueColorLayer);

  var post_cir = postImageGreenestClip.select(['Oa20_radiance', 'Oa12_radiance', 'Oa08_radiance']);
  map.addLayer(post_cir, {min:15, max:70, gamma: 1.5}, 'post_cir', false);
  var pre_cir = preImageGreenestClip.select(['Oa20_radiance', 'Oa12_radiance', 'Oa08_radiance']);
  map.addLayer(pre_cir, {min:15, max:70, gamma: 1.5}, 'pre_cir', false);
  var post_swir = postImageGreenestClip.select(['Oa12_radiance', 'Oa20_radiance', 'Oa08_radiance']);
  map.addLayer(post_swir, {min:15, max:90, gamma:1}, 'post_swir', false);
  var pre_swir = preImageGreenestClip.select(['Oa12_radiance', 'Oa20_radiance', 'Oa08_radiance']);
  map.addLayer(pre_swir, {min:15, max:90, gamma:1}, 'pre_swir', false);

  // Create two versions of the all lands layer - one for low zoom, one for high zoom
  // Both stay in memory but only one is shown at a time based on zoom level
  var standardAllLandsLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(waterMask)
    .clip(geometry);

  var reprojectedAllLandsLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(waterMask)
    .clip(geometry)
    .reproject({crs: 'EPSG:4326', scale: 240});

  // Create two versions of the deciduous layer - one for low zoom, one for high zoom
  // Both stay in memory but only one is shown at a time based on zoom level
  var standardDeciduousLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(deciduousMask)
    .clip(geometry);

  var reprojectedDeciduousLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(deciduousMask)
    .clip(geometry)
    .reproject({crs: 'EPSG:4326', scale: 240});

  // Create two versions of the evergreen layer - one for low zoom, one for high zoom
  // Both stay in memory but only one is shown at a time based on zoom level
  var standardEvergreenLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(evergreenMask)
    .clip(geometry);

  var reprojectedEvergreenLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(evergreenMask)
    .clip(geometry)
    .reproject({crs: 'EPSG:4326', scale: 240});

  // Create two versions of the forest layer - one for low zoom, one for high zoom
  // Both stay in memory but only one is shown at a time based on zoom level
  var standardForestLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(forestMask)
    .clip(geometry);

  var reprojectedForestLayer = ndviChangeProduct
    .sldStyle(index_sld_map[changeType])
    .mask(forestMask)
    .clip(geometry)
    .reproject({crs: 'EPSG:4326', scale: 240});

  // Start with just the standard layer at appropriate visibility
  var currentZoom = map.getZoom();

  var allLandsLayerIndex = map.layers().length();  // This will be the index where we add the all lands layer

  // Add the appropriate layer based on initial zoom
  if (currentZoom >= 12) {
    map.addLayer(
      reprojectedAllLandsLayer,
      {},
      'NDVI change - all lands',
      false
    );
  } else {
    map.addLayer(
      standardAllLandsLayer,
      {},
      'NDVI change - all lands',
      false
    );
  }

  var deciduousLayerIndex = map.layers().length();  // This will be the index where we add the deciduous layer

  // Add the appropriate layer based on initial zoom
  if (currentZoom >= 12) {
    map.addLayer(
      reprojectedDeciduousLayer,
      {},
      'NDVI change - deciduous forest only',
      false
    );
  } else {
    map.addLayer(
      standardDeciduousLayer,
      {},
      'NDVI change - deciduous forest only',
      false
    );
  }

  var evergreenLayerIndex = map.layers().length();  // This will be the index where we add the evergreen layer

  // Add the appropriate layer based on initial zoom
  if (currentZoom >= 12) {
    map.addLayer(
      reprojectedEvergreenLayer,
      {},
      'NDVI change - evergreen forest only',
      false
    );
  } else {
    map.addLayer(
      standardEvergreenLayer,
      {},
      'NDVI change - evergreen forest only',
      false
    );
  }

  var forestLayerIndex = map.layers().length();  // This will be the index where we add the forest layer

  // Add the appropriate layer based on initial zoom
  if (currentZoom >= 12) {
    map.addLayer(
      reprojectedForestLayer,
      {},
      'NDVI change - forest only',
      true
    );
  } else {
    map.addLayer(
      standardForestLayer,
      {},
      'NDVI change - forest only',
      true
    );
  }

  addHillshade(geometry);
  addBoundaries(geometry);

  // Track if we're in high zoom mode
  var isHighZoom = currentZoom >= 12;

  // Add a listener for zoom changes to replace layers when crossing the threshold
  sentinel3ZoomListener = map.onChangeZoom(function() {
    var newZoom = map.getZoom();
    var newIsHighZoom = newZoom >= 12;
    var forestShown = true;
    var allLandsShown = false;
    var deciduousShown = false;
    var evergreenShown = false;

    // Only take action if we've crossed the threshold
    if (newIsHighZoom !== isHighZoom) {
      // Update our state
      isHighZoom = newIsHighZoom;

      // Remove the current forest layer
      map.layers().forEach(function(layer, index) {
        if (layer.getName() === 'NDVI change - forest only') {
          map.layers().remove(layer);
          forestShown = layer.getShown();
        }
      });

      // Remove the all lands layer
      map.layers().forEach(function(layer, index) {
        if (layer.getName() === 'NDVI change - all lands') {
          map.layers().remove(layer);
          allLandsShown = layer.getShown();
        }
      });

      // Remove the deciduous layer
      map.layers().forEach(function(layer, index) {
        if (layer.getName() === 'NDVI change - deciduous forest only') {
          map.layers().remove(layer);
          deciduousShown = layer.getShown();
        }
      });

      // Remove the evergreen layer
      map.layers().forEach(function(layer, index) {
        if (layer.getName() === 'NDVI change - evergreen forest only') {
          map.layers().remove(layer);
          evergreenShown = layer.getShown();
        }
      });

      // Add the appropriate layer for the new zoom level at the stored index
      if (isHighZoom) {
        // Add the reprojected layer for high zoom at the specific index
        map.layers().insert(allLandsLayerIndex, ui.Map.Layer(reprojectedAllLandsLayer, {}, 'NDVI change - all lands', allLandsShown));
        map.layers().insert(deciduousLayerIndex, ui.Map.Layer(reprojectedDeciduousLayer, {}, 'NDVI change - deciduous forest only', deciduousShown));
        map.layers().insert(evergreenLayerIndex, ui.Map.Layer(reprojectedEvergreenLayer, {}, 'NDVI change - evergreen forest only', evergreenShown));
        map.layers().insert(forestLayerIndex, ui.Map.Layer(reprojectedForestLayer, {}, 'NDVI change - forest only', forestShown));
        print('Added four reprojected layers at zoom level ' + newZoom);
      } else {
        // Add the standard layer for low zoom at the specific index
        map.layers().insert(allLandsLayerIndex, ui.Map.Layer(standardAllLandsLayer, {}, 'NDVI change - all lands', allLandsShown));
        map.layers().insert(deciduousLayerIndex, ui.Map.Layer(standardDeciduousLayer, {}, 'NDVI change - deciduous forest only', deciduousShown));
        map.layers().insert(evergreenLayerIndex, ui.Map.Layer(standardEvergreenLayer, {}, 'NDVI change - evergreen forest only', evergreenShown));
        map.layers().insert(forestLayerIndex, ui.Map.Layer(standardForestLayer, {}, 'NDVI change - forest only', forestShown));
        print('Added four standard layers at zoom level ' + newZoom);
      }
    }
  });
};

var submitChangeAnalysis = function (satelliteProps) {
  // remove old layers
  map.layers().reset();

  // make global layers null
  ndviChangeForestOnlyLayer = null;
  ndviChangeEvergreenLayer = null;
  ndviChangeDeciduousLayer = null;
  ndviChangeAllLandsLayer = null;
  ndviChangeNoWaterLayer = null;
  preImageGreenestClip = null;
  postImageGreenestClip = null;
  preTrueColorLayer = null;
  postTrueColorLayer = null;
  ndviChangeProduct = null;
  combinedCloudMask = null;

  // update geometry with map extent at time of analysis
  exportImageGeometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale());

  // set inspector label back to default value
  inspectorLabel.setValue(inspectorLabelDefaultMsg);

  var preStart = ee.Date(dateFilterPreDateStart.getValue());
  var preEnd = ee.Date(dateFilterPreDateEnd.getValue());
  var postStart = ee.Date(dateFilterPostDateStart.getValue());
  var postEnd = ee.Date(dateFilterPostDateEnd.getValue());

  var geometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale());
  if (satelliteProps.combined !== true) {
    // check if we're processing L5/L8 or L8/L9 combined satellites
    preImageGreenestClip = disturbance(satelliteProps, 'NDVI', preStart, preEnd, geometry);
    postImageGreenestClip = disturbance(satelliteProps, 'NDVI', postStart, postEnd, geometry);
  } else {
    preImageGreenestClip = disturbanceCombined(satelliteProps, 'NDVI', preStart, preEnd, geometry);
    postImageGreenestClip = disturbanceCombined(satelliteProps, 'NDVI', postStart, postEnd, geometry);
  }

  preImageGreenestClip.bandNames().evaluate(function (preBandNames) {
    postImageGreenestClip.bandNames().evaluate(function (postBandNames) {
      if (preBandNames.length === 0 || postBandNames.length === 0) {
        print('No pre or post image available. Returning');
        errorPanel.style().set('shown', true);
        return;
      }
    });
  });

  // create a mask for the areas that would be masked out as clouds and add to map
  var preCloudMask = preImageGreenestClip.select(QA_BAND).lt(CLOUD_THRESHOLD);
  var postCloudMask = postImageGreenestClip.select(QA_BAND).lt(CLOUD_THRESHOLD);
  combinedCloudMask = preCloudMask.or(postCloudMask);

  // add date used layers to map
  // map.add(ui.Map.Layer(postImageGreenestClip.select('date').randomVisualizer(), {}, 'Post Date Used', false));
  // map.add(ui.Map.Layer(preImageGreenestClip.select('date').randomVisualizer(), {}, 'Pre Date Used', false));


  // post %
  addPercentLayer(
    satelliteProps,
    map,
    postImageGreenestClip,
    'Post True Color',
    geometry,
    95
  );

  // pre %
  addPercentLayer(
    satelliteProps,
    map,
    preImageGreenestClip,
    'Pre True Color',
    geometry,
    95
  );

  if (submitCheckbox.getValue() === true) {
    changeType = 'PERCENT_NDVI';
  }
  ndviChangeProduct = calculateNDVIChange(preImageGreenestClip, postImageGreenestClip, changeType, geometry);

  addHillshade(geometry); // draw the hillshade
  addBoundaries(); // redraw the app boundaries
};

/////////////////////////////////////////////////////////////////
// END MAIN LOGIC FOR CHANGE ANALYSIS
/////////////////////////////////////////////////////////////////






//////////////////////////////////////////////////////////////////////////////
//////  FUNCTION FOR PRE AND POST DISTURBANCE
//////////////////////////////////////////////////////////////////////////////
var disturbance = function (satelliteProps, chosenIndex, startDate, endDate, geometry) {
  var imageCollection = ee
    .ImageCollection(satelliteProps.satellite)
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .linkCollection(csPlus, [QA_BAND]);

  var withIndexAndDate_imageCollection;
  if (chosenIndex === 'NDVI') {
    withIndexAndDate_imageCollection = imageCollection.map(addNDVI(satelliteProps)).map(addDate);
  }

  var greenest_withIndexAndDate_imageCollection = withIndexAndDate_imageCollection.qualityMosaic(chosenIndex);

  var greenest_withIndexAndDate_imageCollection_clip = greenest_withIndexAndDate_imageCollection.clip(geometry);

  return greenest_withIndexAndDate_imageCollection_clip;
};





//////////////////////////////////////////////////////////////////////////////
//////  FUNCTION FOR PRE AND POST DISTURBANCE COMBINED SATELLITES
//////////////////////////////////////////////////////////////////////////////
var disturbanceCombined = function (satelliteProps, chosenIndex, startDate, endDate, geometry) {
  // Two keys are used here. sat0 and sat1. It's just an easy way to reference two different satellites to merge
  var sat0Bands = ee.Dictionary(satelliteProps.sat0Bands);
  var sat0ImageCollection = ee.ImageCollection(satelliteProps.sat0).select(sat0Bands.values(), sat0Bands.keys());

  var sat1Bands = ee.Dictionary(satelliteProps.sat1Bands);
  var sat1ImageCollection = ee.ImageCollection(satelliteProps.sat1).select(sat1Bands.values(), sat1Bands.keys());

  var combinedSatellites = ee
    .ImageCollection(sat0ImageCollection.merge(sat1ImageCollection))
    .filterDate(startDate, endDate)
    .filterBounds(Map.getBounds(true))
    .linkCollection(csPlus, [QA_BAND]);

  var withIndexAndDate_imageCollection;
  if (chosenIndex === 'NDVI') {
    withIndexAndDate_imageCollection = combinedSatellites.map(addNDVI(satelliteProps)).map(addDate);
  }

  var greenest_withIndexAndDate_imageCollection = withIndexAndDate_imageCollection.qualityMosaic(chosenIndex);

  var greenest_withIndexAndDate_imageCollection_clip = greenest_withIndexAndDate_imageCollection.clip(geometry);

  return greenest_withIndexAndDate_imageCollection_clip;
};

var addNDVI = function (satelliteProps) {
  var mapper = function (image) {
    var ndvi = image.normalizedDifference([satelliteProps.bands.nir, satelliteProps.bands.red]).rename('NDVI');
    return image.addBands(ndvi);
  };
  return mapper;
};

var addDate = function (image) {
  var date = ee.Date(image.get('system:time_start'));
  var dateString = date.format('yyyyMMdd');
  var dateNumber = ee.Number.parse(dateString);
  var dateBand = ee.Image.constant(dateNumber).uint32().rename('date');
  return image.addBands(dateBand);
};





//////////////////////////////////////////////////////////////////
////  CALCULATE NDVI CHANGE
//////////////////////////////////////////////////////////////////
var calculateNDVIChange = function (pre, post, changeType, geometry) {
  var forestMask = NLCDForestMask(geometry);
  var deciduousMask = NLCDDeciduousMask(geometry);
  var evergreenMask = NLCDEvergreenMask(geometry);
  var waterMask = NLCDWaterMask();
  var postMINUSpre, absNDVIc, absNDVIc_x100, ndviChangeProduct;

  if (changeType === 'ABSOLUTE_NDVI') {
    postMINUSpre = post.subtract(pre);
    // rescale to signed integer 8bit (-127 - 127) to reduce file size
    absNDVIc = postMINUSpre.select('NDVI');
    absNDVIc_x100 = absNDVIc.multiply(100);
    ndviChangeProduct = absNDVIc_x100.int8();
  } else {
    // assumed to be 'PERCENT_NDVI'
    postMINUSpre = post.subtract(pre).divide(pre);
    // rescale to signed integer 8bit (-127 - 127) to reduce file size
    absNDVIc = postMINUSpre.select('NDVI');
    absNDVIc_x100 = absNDVIc.multiply(100);
    ndviChangeProduct = absNDVIc_x100.int8();
  }
  ndviChangeAllLandsLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(waterMask).clip(geometry);
  ndviChangeNoWaterLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(waterMask).clip(geometry);
  ndviChangeForestOnlyLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(forestMask).clip(geometry);
  ndviChangeDeciduousLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(deciduousMask).clip(geometry);
  ndviChangeEvergreenLayer = ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(evergreenMask).clip(geometry);
  // map.add(
  //   ui.Map.Layer(
  //     ndviChangeProduct.sldStyle(index_sld_map[changeType]).clip(geometry),
  //     {},
  //     'NDVI change - all lands',
  //     false
  //   )
  // );
  // map.add(
  //   ui.Map.Layer(
  //     ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(waterMask).clip(geometry),
  //     {},
  //     'NDVI change - no water',
  //     false
  //   )
  // );
  // map.add(
  //   ui.Map.Layer(
  //     ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(forestMask).clip(geometry),
  //     {},
  //     'NDVI change - forest only',
  //     true
  //   )
  // );
  // map.add(
  //   ui.Map.Layer(
  //     ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(deciduousMask).clip(geometry),
  //     {},
  //     'NDVI change - deciduous forest only',
  //     false
  //   )
  // );
  // map.add(
  //   ui.Map.Layer(
  //     ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(evergreenMask).clip(geometry),
  //     {},
  //     'NDVI change - evergreen forest only',
  //     false
  //   )
  // );

  return ndviChangeProduct;
};



//////////////////////////////////////////////////////////////////
////  FUNCTIONS FOR ADDING PERCENT LAYER
/////////////////////////////////////////////////////////////////

function addPercentLayer(satelliteProps, map, image, layerName, geometry, percent) {
  var gammaValue = 1.5;
  var lower_percentile = ee.Number(100).subtract(percent).divide(2);
  var upper_percentile = ee.Number(100).subtract(lower_percentile);
  var stats = image.select([satelliteProps.bands.red, satelliteProps.bands.green, satelliteProps.bands.blue],['value_red', 'value_green', 'value_blue']).reduceRegion({
    reducer: ee.Reducer.percentile({
      percentiles: [lower_percentile, upper_percentile],
      outputNames: ['lower', 'upper'],
    }),
    geometry: geometry,
    scale: satelliteProps.scale,
    bestEffort: true
  });
  var vis_params = ee.Dictionary({
    'min': [
      ee.Number(stats.get('value_red_lower')),
      ee.Number(stats.get('value_green_lower')),
      ee.Number(stats.get('value_blue_lower'))
    ],
    'max': [
      ee.Number(stats.get('value_red_upper')),
      ee.Number(stats.get('value_green_upper')),
      ee.Number(stats.get('value_blue_upper'))
    ]
  });
  vis_params.evaluate(function(params) {
    ee.Array(params.min).reduce(ee.Reducer.mean(), [0]).get([0]).evaluate(function(minValue) {
      ee.Array(params.max).reduce(ee.Reducer.mean(), [0]).get([0]).evaluate(function(maxValue) {
        if (layerName === "Pre True Color") {
          preTrueColorLayer = ui.Map.Layer({
            eeObject: image,
            visParams: {
              bands: [satelliteProps.bands.red, satelliteProps.bands.green, satelliteProps.bands.blue],
              min: minValue,
              max: maxValue,
              gamma: 1.5
            },
            name: layerName,
            shown: false
          })} else {
          postTrueColorLayer = ui.Map.Layer({
            eeObject: image,
            visParams: {
              bands: [satelliteProps.bands.red, satelliteProps.bands.green, satelliteProps.bands.blue],
              min: minValue,
              max: maxValue,
              gamma: 1.5
            },
            name: layerName,
            shown: false
          });
        }
        // }
        // map.addLayer({
        //   eeObject: image,
        //   visParams: {
        //     bands: [satelliteProps.bands.red, satelliteProps.bands.green, satelliteProps.bands.blue],
        //     min: minValue,
        //     max: maxValue,
        //     gamma: 1.5
        //   },
        //   name: layerName,
        //   shown: false
        // });
        enableSubmit();
        addLayersToMap();
      });
    });
  });
}





// MASKS AND HELPER FUNCTIONS

var NLCDWaterMask = function () {
  var dataset21 = ee.ImageCollection('USGS/NLCD_RELEASES/2021_REL/NLCD');
  var nlcd2021 = dataset21.filter(ee.Filter.eq('system:index', '2021')).first();
  var nlcd_2021_landcover_img = nlcd2021.select('landcover');
  // mask out water
  var nowater = nlcd_2021_landcover_img
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

  return nowater;
};

var NLCDForestMask = function (geometry) {
  var dataset21 = ee.ImageCollection('USGS/NLCD_RELEASES/2021_REL/NLCD');
  var nlcd2021 = dataset21.filter(ee.Filter.eq('system:index', '2021')).first();
  var nlcd_2021_landcover_img = nlcd2021.select('landcover');
  var forest2021 = nlcd_2021_landcover_img
    .eq(41)
    .or(nlcd_2021_landcover_img.eq(42))
    .or(nlcd_2021_landcover_img.eq(43))
    .or(nlcd_2021_landcover_img.eq(90));
  var forest = forest2021.eq(1).clip(geometry);

  return forest;
};

var NLCDDeciduousMask = function (geometry) {
  var dataset21 = ee.ImageCollection('USGS/NLCD_RELEASES/2021_REL/NLCD');
  var nlcd2021 = dataset21.filter(ee.Filter.eq('system:index', '2021')).first();
  var nlcd_2021_landcover_img = nlcd2021.select('landcover');
  var deciduous2021 = nlcd_2021_landcover_img
    .eq(41)
    .or(nlcd_2021_landcover_img.eq(43))
    .or(nlcd_2021_landcover_img.eq(90));
  var deciduous = deciduous2021.eq(1).clip(geometry);

  return deciduous;
};

var NLCDEvergreenMask = function (geometry) {
  var dataset21 = ee.ImageCollection('USGS/NLCD_RELEASES/2021_REL/NLCD');
  var nlcd2021 = dataset21.filter(ee.Filter.eq('system:index', '2021')).first();
  var nlcd_2021_landcover_img = nlcd2021.select('landcover');
  var evergreen2021 = nlcd_2021_landcover_img.eq(42).or(nlcd_2021_landcover_img.eq(43));
  var evergreen = evergreen2021.eq(1).clip(geometry);

  return evergreen;
};

var addBoundaries = function () {
  // Get the current map extent
  var currentBounds = Map.getBounds(true);

  // Boundaries US States and Counties
  var dataset = ee.FeatureCollection('TIGER/2016/Counties').filterBounds(currentBounds);
  var visParams = {
    palette: ['purple', 'blue', 'green', 'yellow', 'orange', 'red'],
    min: 0,
    max: 50,
    opacity: 0.8,
  };

  var stateDataset = ee.FeatureCollection('TIGER/2016/States').filterBounds(currentBounds);

  // Turn the strings into numbers
  dataset = dataset.map(function (f) {
    return f.set('STATEFP', ee.Number.parse(f.get('STATEFP')));
  });

  var countyOutlines = ee.Image().float().paint({
    featureCollection: dataset,
    color: 'black',
    width: 1,
  });

  var stateOutlines = ee.Image().float().paint({
    featureCollection: stateDataset,
    color: 'black',
    width: 3,
  });

  var allproclaimed = table.filterBounds(currentBounds);

  var empty = ee.Image().byte();
  var outline = empty.paint({
    featureCollection: allproclaimed,
    color: 1,
    width: 1.5,
  });

  var allproc_surfwindow = ee.FeatureCollection('users/srs4854gee/non_fs_082023');
  // clip surface owned to current extent
  var clipped_allproc_surfwindow = allproc_surfwindow.filterBounds(currentBounds);
  var vis = {
    fillColor: '00000080',
    width: 0,
  };

  var visallproc_surfwindow = clipped_allproc_surfwindow.style(vis);

  // Add FS Admin outlines to the map
  stateBordersLayer = ui.Map.Layer(stateOutlines, {}, 'State borders');
  countyBordersLayer = ui.Map.Layer(countyOutlines, {}, 'County borders', false);
  fsSurfaceOwnedWindowLayer = ui.Map.Layer(visallproc_surfwindow, {}, 'FS Surface-Owned window', false);
  fsProclaimedLayer = ui.Map.Layer(outline, { palette: '66ff00' }, 'FS Proclaimed', false);

  Map.add(fsSurfaceOwnedWindowLayer);
  Map.add(fsProclaimedLayer);
  Map.add(countyBordersLayer);
  Map.add(stateBordersLayer);
};

var addHillshade = function (geometry) {
  var dataset = ee.Image('USGS/3DEP/10m');
  var elevation = dataset.select('elevation');
  var hillshade = ee.Terrain.hillshade(elevation);
  var datasetVis = {
    min: 0.0,
    max: 255.0,
    gamma: 0.4,
    opacity: 0.225,
  };

  var Ten_m_clip = hillshade.clip(geometry);
  map.add(ui.Map.Layer(Ten_m_clip, datasetVis, 'Hillshade', false));
  // map.layers().insert(index, ui.Map.Layer(Ten_m_clip, datasetVis, 'Hillshade', false));
  // removeLayerByName('Calculating...');
};

// THIS IS THE OLD app.boot()
// Everything that is needed to actually boot the application
addBoundaries();
if (ui.url.get('autoRun') === true) {
  ui.util.setTimeout(function() {
    if (satelliteSelector.getValue() === "Sentinel 3 TOA") {
      submitSentinel3ChangeAnalysis(SATELLITE_PROPERTIES[satelliteSelector.getValue()]);
    } else {
      submitChangeAnalysis(SATELLITE_PROPERTIES[satelliteSelector.getValue()]);
      submit.setDisabled(true);
      disableSubmit();
    }
  }, 2000);
}
ui.root.insert(0, leftPanel);
map.add(legend);
