var table = ee.FeatureCollection('users/srs4854gee/fs_proclaimed_042622');
var table2 = ee.FeatureCollection('users/srs4854gee/fs_surface_own_042622');

////////////////////////////////////////////////////////////////
//  HIFORM NDVI CHANGE SCRIPT (https://HiForm.org)
////////////////////////////////////////////////////////////////

// 'Absolute Change in NDVI' using Sentinel-2 and Landsat image collections
//    FS vs non-FS exporting, see line 1260 - selection sets export beharior

// Bill Christie, RS/GIS Analyst, USFS, Southern Research Station, william.m.christie@usda.gov
// Steve Norman, Research Landscape Ecologist, USFS, Southern Research Station, steve.norman@usda.gov
//    Resources - https://hiform.org/mapping-workflow
//                https://forestthreats.org;

//                find cloudfree1 - https://apps.sentinel-hub.com/eo-browser/?zoom=5&lat=38.32442&lng=-103.22754&themeId=DEFAULT-THEME&toTime=2021-06-11T10%3A59%3A39.478Z
//                find cloudfree2 - https://showcase.earthengine.app/view/s2-sr-browser-s2cloudless-nb

//    christie maintenance - bottom of script

////////////////////////////////////////////////////////////////
// Customization of user interface -
//   Dave Michelson (dmichels@unca.edu)
//   Jeff Bliss (jbliss@unca.edu)
//   Sean Matthew (smatthe2@unca.edu)
//           https://nemac.unca.edu/
////////////////////////////////////////////////////////////////

// select a proclaimed boundary for analysis (based on choice use lines 70-73 to modify 65-67)

// // var proclaimed = table.filter(ee.Filter.eq("UNIT_NM",'Nantahala National Forest'));
// // var proclaimed = table.filter(ee.Filter.eq("UNIT_NM",'Pisgah National Forest'));
// // var proclaimed = table.filter(ee.Filter.eq("UNIT_NM",'Uwharrie National Forest'));
// // var proclaimed = table.filter(ee.Filter.eq("UNIT_NM",'Croatan National Forest'));

// var proclaimed = table.filter(ee.Filter.eq("UNIT_NM",'De Soto National Forest'));

// // var empty = ee.Image().byte();
// // var outline = empty.paint({
// //   featureCollection: surfown,
// //   color: 1,
// //   width: 1});
// // Map.addLayer(outline, {palette: '66ff00'}, 'NF outline ras');
// // Map.addLayer(surfown, {palette: '66ff00'}, 'NF outline poly');

// var geometry = proclaimed;

////////////////////////////////////////////////////////////////

// Imports from other scripts
var helperFunctionsImport = require('users/jbliss/hiform:HiForm_Multiple_Scripts/HelperFunctions');
var stdDeviationImport = require('users/jbliss/hiform:HiForm_Multiple_Scripts/StandardDeviation');
var removeLayerByName = helperFunctionsImport.removeLayerByName;
var checkIfDateOkay = helperFunctionsImport.checkIfDateOkay;
var getLayer = helperFunctionsImport.getLayer;

/////////////////////////////////////////////////////////////////
// BEGIN GLOBAL VARIABLES AND CONSTANTS
/////////////////////////////////////////////////////////////////

// Creates the map
var map = Map;
var user = 'FS'; // all 3 unsubmitted, DEFAULT state
//var user = 'NonFS'; // all 3 auto-export to g-drive
// limit draw tools to just polygon
var drawingTools = Map.drawingTools();
drawingTools.setDrawModes(['polygon', 'point']);
map.setControlVisibility(true);
var lng = ui.url.get('lng', -82.5795);
var lat = ui.url.get('lat', 35.592);
var mapZoom = ui.url.get('mapZoom', 12);

// center on a nf
// NC, Nantahala National Forest, -83.4096, 35.2092, 10
// NC, Pisgah National Forest, -82.3858, 35.8885, 9
// NC, Uwharrie National Forest, -79.9358, 35.3996, 10
// NC, Croatan National Forest, -77.0347, 34.899, 10

// MS, Desoto National Forest, -88.9908, 30.8506, 10

map.setCenter(lng, lat, mapZoom);

var preImageGreenestClip; // includes date and chosen index (NDVI at the moment)
var postImageGreenestClip; // includes date and chosen index (NDVI at the moment)
var ndviChangeProduct; // NDVI product
var exportImageGeometry; // Capture map extent when "Do the change analysis" is clicked and use for export
var defaultSatellite = ui.url.get('satellite', 'Sentinel 2 TOA');
var currentDate = ee.Date(Date.now()).format('yyyy-MM-dd').getInfo();
var mapExtentBufferMultiplier = 1;
var inspectorLabelDefaultMsg = 'Click on a location for: \n- Dates used\n- NDVI\n- Min and max values';

var SATELLITE_PROPERTIES = {
  // 'Landsat 5 TOA': {
  //   'satellite': 'LANDSAT/LT05/C02/T1_TOA',
  //   'scale': 30,
  //   'bands': { 'blue': 'B1', 'green': 'B2', 'red': 'B3', 'nir': 'B4', 'swir1': 'B5', 'swir2': 'B7' },
  //   'min': 0,
  //   'max': 0.4,
  //   'startDate': '1984-03 to 2012-05',
  //   'endDate': '2012-05-05'
  // },
  // 'Landsat 5 SR': {
  //   'satellite': 'LANDSAT/LT05/C02/T1_L2',
  //   'scale': 30,
  //   'bands': { 'blue': 'SR_B1', 'green': 'SR_B2', 'red': 'SR_B3', 'nir': 'SR_B4', 'swir1': 'SR_B5', 'swir2': 'SR_B7', },
  //   'min': 5000,
  //   'max': 15000,
  //   'startDate': '1984-03 to 2012-05',
  //   'endDate': '2012-05-05'
  // },
  'Landsat 8 Real-Time': {
    satellite: 'LANDSAT/LC08/C02/T1_RT_TOA',
    bands: { blue: 'B2', green: 'B3', red: 'B4', nir: 'B5', swir1: 'B6', swir2: 'B7' },
    scale: 30,
    min: 0.03,
    max: 0.2,
    startDate: '2013-03-18',
    endDate: currentDate,
  },
  // 'Landsat 8 TOA': {
  //   'satellite': 'LANDSAT/LC08/C02/T1_TOA',
  //   'scale': 30,
  //   'bands': { 'blue': 'B2', 'green': 'B3', 'red': 'B4', 'nir': 'B5', 'swir1': 'B6', 'swir2': 'B7', },
  //   'min': 0,
  //   'max': 0.4,
  //   'startDate': '2013',
  //   'endDate': currentDate
  // },
  // 'Landsat 8 SR': {
  //   'satellite': 'LANDSAT/LC08/C02/T1_L2',
  //   'scale': 30,
  //   'bands': { 'blue': 'SR_B2', 'green': 'SR_B3', 'red': 'SR_B4', 'nir': 'SR_B5', 'swir1': 'SR_B6', 'swir2': 'SR_B7', },
  //   'min': 5000,
  //   'max': 15000,
  //   'startDate': '2013',
  //   'endDate': currentDate
  // },
  // 'Landsat 9 TOA': {
  //   'satellite': 'LANDSAT/LC09/C02/T1_TOA',
  //   'scale': 30,
  //   'bands': { 'blue': 'B2', 'green': 'B3', 'red': 'B4', 'nir': 'B5', 'swir1': 'B6', 'swir2': 'B7', },
  //   'min': 0.03,
  //   'max': 0.2,
  //   'startDate': '2021-10-31',
  //   'endDate': currentDate
  // },
  // 'Landsat 9 SR': {
  //   'satellite': 'LANDSAT/LC09/C02/T1_L2',
  //   'scale': 30,
  //   'bands': { 'blue': 'SR_B2', 'green': 'SR_B3', 'red': 'SR_B4', 'nir': 'SR_B5', 'swir1': 'SR_B6', 'swir2': 'SR_B7', },
  //   'min': 7500,
  //   'max': 15000,
  //   'startDate': '2021-10-31',
  //   'endDate': currentDate
  // },
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
    endDate: currentDate,
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
    endDate: currentDate,
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
    endDate: currentDate,
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
    endDate: currentDate,
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
    endDate: currentDate,
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
    endDate: currentDate,
    scale: 30,
    min: 5000,
    max: 15000,
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

var submitCounter = 0; // count the asynchronous calls to decide when to re-enable submit

var index_sld_map = {
  ABSOLUTE_NDVI: sld_intervals_absolute_ndvi,
  PERCENT_NDVI: sld_intervals_percent_ndvi,
};
/////////////////////////////////////////////////////////////////
// END GLOBAL VARIABLES AND CONSTANTS
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

function getLayerByName(layerName) {
  var layers = Map.layers();

  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    var title = ee.String(layer.get('name'));

    if (title.getInfo() === layerName) {
      return layer;
    }
  }

  return null; // Layer not found
}

// Helper functions to easily disable and enable all widgets for a panel

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
var versionDateLabel = createNewLabel('ver. 04/05/2024', 'horizontal', 'left', 'bold', '10px', '8px 8px 8px 8px');
var title = createNewLabel('HiForm-2 Change Mapper', 'horizontal', 'left', 900, '18px', '8px 8px 8px 8px');
var satelliteLabel = createNewLabel('1. Choose Satellite', 'horizontal', 'left', 500, '16px', '12px 8px 0px 24px');
var validDateRange = createNewLabel(
  'Start Date: ' + SATELLITE_PROPERTIES[defaultSatellite].startDate,
  'horizontal',
  'left',
  500,
  '14px',
  '0 8px 12px 64px'
);
var dateSelectLabel = createNewLabel('2. Set Dates', 'horizontal', 'left', 500, '16px', '12px 8px 0px 24px');
var preDisturbanceLabel = createNewLabel(
  'Pre-Disturbance Image dates',
  'horizontal',
  'left',
  500,
  '14px',
  '3px 8px 0 64px'
);
var postDisturbanceLabel = createNewLabel(
  'Post-Disturbance Image dates',
  'horizontal',
  'left',
  500,
  '14px',
  '8px 8px 0 64px'
);
var actionsLabel = createNewLabel('3. Actions', 'horizontal', 'left', 500, '16px', '8px 8px 0 24px');
var explorationLabel = createNewLabel('4. Exploration', 'horizontal', 'left', 500, '16px', '8px 8px 0 24px');
// end label creation

// Create satellite UI selector.
var satelliteSelectOnChange = function (newValue) {
  validDateRange.setValue('Start Date: ' + SATELLITE_PROPERTIES[newValue].startDate); // set new dates
  inspectorLabel.setValue(inspectorLabelDefaultMsg); // refresh inspector to default state
};

var satelliteNames = ee
  .Dictionary(SATELLITE_PROPERTIES)
  .keys()
  .sort()
  .remove('Landsat 8 Real-Time')
  .insert(2, 'Landsat 8 Real-Time')
  .getInfo();

var satelliteSelector = createUISelect(
  satelliteNames,
  defaultSatellite,
  defaultSatellite,
  satelliteSelectOnChange,
  { textAlign: 'left', minWidth: '150px', margin: '3px 8px 3px 64px' },
  false
);

//////////////////////////////////////////
// Blue Band Cloud Mask Sliders
//////////////////////////////////////////

var minMaxValues = [0, 2000]; //default values before change analysis

var initializeCloudSlider = function (image) {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];

  // TODO See if we can get this working with combined TOA
  // check is this is a TOA combined
  var isTOA = false;
  if (satelliteProps.keys) {
    for (var i = 0; i < satelliteProps.keys.length; i++) {
      if (satelliteProps.keys[i].indexOf('TOA') !== -1) {
        print('Blue Band Cloud Mask Slider currently unavailable for combined TOA Satellites');
        isTOA = true; // Substring found in one of the strings
        enableSubmit(); // make sure change analysis doesn't hang
      }
    }
  }
  if (isTOA) {
    return;
  }
  // Get the current map extent
  var bounds = Map.getBounds(true);

  // Clip the image to the map extent
  var clippedImage = image.clip(bounds);

  // Get the min and max pixel values
  var minMax = clippedImage.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: bounds,
    scale: Map.getScale(),
  });
  // Extract the min and max values
  image.evaluate(function (img) {
    var band = img.bands[0];
    var bandMin = band.id + '_min';
    var bandMax = band.id + '_max';
    var minValue = minMax.getNumber(bandMin);
    var maxValue = minMax.getNumber(bandMax);
    // Return the result
    var minMaxValues = ee.List([minValue, maxValue]);
    minMaxValues.evaluate(function (param) {
      minValue = param[0];
      maxValue = param[1];

      var stepSize = (maxValue - minValue) / 1000;
      var defaultVal = (maxValue + minValue) / 2;
      // Calculate the most significant digit
      var msd = Math.pow(10, Math.floor(Math.log(stepSize) / Math.LN10));

      // Round the number to 1 in the most significant digit
      var roundedStep = Math.round(stepSize / msd) * msd;

      BBsliderPost.setMin(minValue);
      BBsliderPost.setMax(maxValue);
      BBsliderPost.setStep(stepSize);
      BBsliderPost.setValue(defaultVal); // default to average Average
      BBsliderLabel.setValue('Cloud Mask (Blue Band)');
      BBsliderPost.setDisabled(false);
      BBsliderPost.style().set({ shown: true });
      enableSubmit();
    });
  });
};

var showSlidersButton = ui.Button({
  label: 'Show Cloud Mask Slider',
  onClick: function () {
    var maskLayer = getLayer('Blue Band Cloud Mask', map);
    var currentVisSliderPanel = sliderPanel.style().get('shown');
    if (!currentVisSliderPanel && maskLayer) {
      maskLayer.setShown(true);
    }
    sliderPanel.style().set('shown', !currentVisSliderPanel);
  },
  style: {
    position: 'top-left',
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var BBsliderLabel = ui.Label({
  value: 'Cloud Mask (Blue Band)',
  style: {
    color: 'white',
    backgroundColor: '#7e5f01',
    position: 'top-center',
    minWidth: '50px',
    margin: '3px 8px 3px 8px',
    shown: true,
  },
});

var postMaskOnChangeBB = function (value) {
  var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];

  // Find out if layer is toggled on or off
  var prevLayer = getLayer('Blue Band Cloud Mask', map);
  var prevShown = false;
  if (prevLayer != null) {
    prevShown = prevLayer.getShown();
  }
  // remove old layer
  removeLayerByName('Blue Band Cloud Mask', map);

  BBsliderPost.setDisabled(true);
  var bandPost = postImageGreenestClip.select(satelliteProps.bands.blue);

  // new code in here to play around with resampling to 60 meters
  var projection = bandPost.select(satelliteProps.bands.blue).projection();
  var bands = bandPost.select(satelliteProps.bands.blue);
  var resample = bands.reproject({
    crs: projection,
    scale: 60,
  });
  // end new resampling code

  var bandPostMask = resample.gt(value).selfMask();

  map
    .layers()
    .insert(
      9,
      ui.Map.Layer(bandPostMask, { min: 500, max: 2002, palette: '000000' }, 'Blue Band Cloud Mask', prevShown)
    );

  BBsliderPost.setDisabled(false);
};

// Post Image Slider
var BBsliderPost = ui.Slider({
  min: 0,
  max: 1000,
  value: 500,
  step: 1,
  style: {
    color: 'white',
    backgroundColor: '#7e5f01',
    position: 'top-center',
    margin: '3px 8px 3px 8px',
    height: '100%',
    width: '550px',
    shown: true,
  },
  onChange: postMaskOnChangeBB,
  disabled: true,
});

//////////////////////////////////////////
// END Blue Band Cloud Mask Sliders
//////////////////////////////////////////

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
var preDisturbanceStartDate = ui.url.get('preDisturbanceStartDate', '2023-06-01');
var preDisturbanceEndDate = ui.url.get('preDisturbanceEndDate', '2023-08-30');
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
var postDisturbanceStartDate = ui.url.get('postDisturbanceStartDate', '2024-06-01');
var postDisturbanceEndDate = ui.url.get('postDisturbanceEndDate', '2024-08-30');
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
  if (override !== true && submitCounter < 2) {
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
    var satelliteProps = SATELLITE_PROPERTIES[satelliteSelector.getValue()];
    submit.setDisabled(true);
    disableSubmit();
    submitChangeAnalysis(satelliteProps);
    if (postImageGreenestClip.bandNames().getInfo().length === 0) {
      print('No post image available. Returning.');
      return;
    }
    BBsliderPost.setDisabled(true);
    BBsliderPost.style().set({ shown: false });
    BBsliderLabel.setValue('Calculating New Blue Band Cloud Mask Values. Please wait...');
    initializeCloudSlider(postImageGreenestClip.select(satelliteProps.bands.blue));
  },
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var submitCheckbox = ui.Checkbox({ label: '%', value: false });

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
  var forestMask = NLCDForestMask(exportImageGeometry);

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
  var forestMask = NLCDForestMask(exportImageGeometry);

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
  exportImageGeometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale() * mapExtentBufferMultiplier);
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

var exportImageToGoogleCloud = function () {
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

  var imageToExport = ndviChangeProduct;
  if (exportImageSelector.getValue() === 'Post True Color') {
    imageToExport = postImageGreenestClip.select([
      satelliteProps.bands.red,
      satelliteProps.bands.green,
      satelliteProps.bands.blue,
    ]);
  }
  Export.image.toCloudStorage({
    image: imageToExport,
    description: 'export image to google cloud',
    //assetId: 'exampleExport',
    //bucket: 'ee-docs-demos',
    fileNamePrefix: 'image-name-' + rundate,
    scale: SATELLITE_PROPERTIES[satelliteSelector.getValue()].scale,
    region: exportImageGeometry,
  });
};

var exportImageToDriveTask = function (satelliteProps) {
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

  var imageToExport = ndviChangeProduct;
  if (exportImageSelector.getValue() === 'Post True Color') {
    imageToExport = postImageGreenestClip.select([
      satelliteProps.bands.red,
      satelliteProps.bands.green,
      satelliteProps.bands.blue,
    ]);
  }
  Export.image.toDrive({
    image: imageToExport,
    description: 'Change_Product_Task' + rundate,
    fileNamePrefix: 'continuous_change_product' + rundate,
    scale: satelliteProps.scale,
    region: exportImageGeometry,
  });
};

var exportImageCloudButton = ui.Button({
  label: 'Export image to Cloud',
  onClick: exportImageToGoogleCloud,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

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
    ExportPTC: exportPTCImageToGoogleDrive,
  },
  FS: {
    exportShapefiles: exportShapefilesToGoogleCloud,
    ExportNDVI: exportNDVIImageToGoogleCloud,
    ExportPTC: exportPTCImageToGoogleCloud,
  },
};

// THIS IS THE TOGGLE POINT FOR FS vs NON FS Users
var exportFunctions = userFunctions[user];

var exportNDVIImageButton = ui.Button({
  label: 'Export Forest Change',
  onClick: exportFunctions.ExportNDVI,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

var exportPTCImageButton = ui.Button({
  label: 'Export Post True Color',
  onClick: exportFunctions.ExportPTC,
  style: {
    minWidth: '150px',
    margin: '3px 8px 3px 64px',
  },
});

// Button for export Polygon
var exportShapefilesButton = ui.Button({
  label: 'Export Drawn Polygon(s)',
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
    ui.url.set('autoRun', false);
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
    dateSelectLabel,
    preDisturbanceLabel,
    dateFilterPreDateStart,
    dateFilterPreDateEnd,
    postDisturbanceLabel,
    dateFilterPostDateStart,
    dateFilterPostDateEnd,
    actionsLabel,
    submitPanel,
    generateURLButton,
    exportNDVIImageButton,
    exportPTCImageButton,
    exportShapefilesButton,
    explorationLabel,
    showSlidersButton,
    inspector,
    legendButton,
    panelButton,
    versionDateLabel,
  ],
  style: {
    width: '280px',
    position: 'top-left',
  },
});

var sliderPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    position: 'bottom-left',
    width: '800px',
    height: '60px',
    backgroundColor: '#7e5f01',
    border: '1px solid #c4ac84',
    shown: false,
  },
  widgets: [BBsliderLabel, BBsliderPost],
});

// Add some widgets or elements to the right panel.

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
  var geometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale() * mapExtentBufferMultiplier);

  var click_point = ee.Geometry.Point(coords.lon, coords.lat);
  var preDate = getLayer('Pre Date Used', map)
    .getEeObject()
    .select('date')
    .reduceRegions(click_point, ee.Reducer.first(), satelliteProps.scale)
    .first()
    .get('first');
  var postDate = getLayer('Post Date Used', map)
    .getEeObject()
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

var submitChangeAnalysis = function (satelliteProps) {
  // remove old layers and disable submit button
  map.layers().reset();

  // update geometry with map extent at time of analysis
  exportImageGeometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale() * mapExtentBufferMultiplier);

  // set inspector label back to default value
  inspectorLabel.setValue(inspectorLabelDefaultMsg);

  var preStart = ee.Date(dateFilterPreDateStart.getValue());
  var preEnd = ee.Date(dateFilterPreDateEnd.getValue());
  var postStart = ee.Date(dateFilterPostDateStart.getValue());
  var postEnd = ee.Date(dateFilterPostDateEnd.getValue());

  var geometry = ee.Geometry(map.getBounds(true)).buffer(map.getScale() * mapExtentBufferMultiplier);
  //var geometry = proclaimed;
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

  // B10sliderPost.setDisabled(false);

  // add layers to map
  map.add(ui.Map.Layer(postImageGreenestClip.select('date').randomVisualizer(), {}, 'Post Date Used', false));
  map.add(ui.Map.Layer(preImageGreenestClip.select('date').randomVisualizer(), {}, 'Pre Date Used', false));

  /*map.addLayer(postImageGreenestClip.select([
    satelliteProps.bands.red,
    satelliteProps.bands.green,
    satelliteProps.bands.blue
  ]), {min: satelliteProps.min, max: satelliteProps.max}, 'Post True Color', false);
  map.addLayer(preImageGreenestClip.select([
    satelliteProps.bands.red,
    satelliteProps.bands.green,
    satelliteProps.bands.blue
  ]), {min: satelliteProps.min, max: satelliteProps.max}, 'Pre True Color', false); */
  // if (satelliteProps.satellite === 'COPERNICUS/S2_HARMONIZED' || satelliteProps.satellite === 'COPERNICUS/S2_SR_HARMONIZED') {
  //   // AG perc based
  //   stdDeviationImport.addAGMinMaxLayer(
  //     satelliteProps, map, postImageGreenestClip, 'Agr. False Color', geometry, 1 //value between 0-1 for percent bounding
  //   );
  // }

  // post std dev
  // stdDeviationImport.addStandardDeviationLayer(
  //   satelliteProps, map, postImageGreenestClip, 'Post True Color', geometry, 2, enableSubmit
  // );
  // post %
  stdDeviationImport.addPercentLayer(
    satelliteProps,
    map,
    postImageGreenestClip,
    'Post True Color',
    geometry,
    95,
    enableSubmit
  );
  // pre std dev
  // stdDeviationImport.addStandardDeviationLayer(
  //   satelliteProps, map, preImageGreenestClip, 'Pre True Color', geometry, 2, enableSubmit
  // );
  // pre %
  stdDeviationImport.addPercentLayer(
    satelliteProps,
    map,
    preImageGreenestClip,
    'Pre True Color',
    geometry,
    95,
    enableSubmit
  );

  var changeType = 'ABSOLUTE_NDVI';
  if (submitCheckbox.getValue() === true) {
    changeType = 'PERCENT_NDVI';
  }
  ndviChangeProduct = calculateNDVIChange(preImageGreenestClip, postImageGreenestClip, changeType, geometry);

  addHillshade(geometry); // draw the hillshade
  addBoundaries(); // redraw the app boundaries
};

//////////////////////////////////////////////////////////////////////////////
//////  FUNCTION FOR PRE AND POST DISTURBANCE
//////////////////////////////////////////////////////////////////////////////
var disturbance = function (satelliteProps, chosenIndex, startDate, endDate, geometry) {
  var imageCollection = ee
    .ImageCollection(satelliteProps.satellite)
    .filterDate(startDate, endDate)
    .filterBounds(geometry);

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
    .filterBounds(Map.getBounds(true));

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
/////////////////////////////////////////////////////////////////
var calculateNDVIChange = function (pre, post, changeType, geometry) {
  // removeLayerByName('NDVI change - all lands', map);
  // removeLayerByName('NDVI change - no water', map);
  // removeLayerByName('NDVI change - forest only', map);
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
  map.add(
    ui.Map.Layer(
      ndviChangeProduct.sldStyle(index_sld_map[changeType]).clip(geometry),
      {},
      'NDVI change - all lands',
      false
    )
  );
  // removeLayerByName('Calculating...');
  map.add(
    ui.Map.Layer(
      ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(waterMask).clip(geometry),
      {},
      'NDVI change - no water',
      false
    )
  );
  // removeLayerByName('Calculating...');
  map.add(
    ui.Map.Layer(
      ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(forestMask).clip(geometry),
      {},
      'NDVI change - forest only',
      true
    )
  );
  map.add(
    ui.Map.Layer(
      ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(deciduousMask).clip(geometry),
      {},
      'NDVI change - deciduous forest only',
      false
    )
  );
  map.add(
    ui.Map.Layer(
      ndviChangeProduct.sldStyle(index_sld_map[changeType]).mask(evergreenMask).clip(geometry),
      {},
      'NDVI change - evergreen forest only',
      false
    )
  );
  // removeLayerByName('Calculating...');
  //map.addLayer(ndviChangeProduct.select([changeType]), {}, 'absolute change b/w', false);
  //map.addLayer(ndviChangeProduct.sldStyle(index_sld_map[changeType]), {}, 'absolute change');

  return ndviChangeProduct;
};

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
  var stateBorderLayer = ui.Map.Layer(stateOutlines, {}, 'State borders');
  var countyBorderLayer = ui.Map.Layer(countyOutlines, {}, 'County borders', false);
  var fsSurfaceOwnedLayer = ui.Map.Layer(visallproc_surfwindow, {}, 'FS Surface-Owned window', false);
  var fsallproclaimedLayer = ui.Map.Layer(outline, { palette: '66ff00' }, 'FS Proclaimed', false);

  Map.add(stateBorderLayer);
  Map.add(countyBorderLayer);
  Map.add(fsSurfaceOwnedLayer);
  Map.add(fsallproclaimedLayer);
};

var addHillshade = function (geometry) {
  var dataset = ee.Image('USGS/3DEP/10m');
  var elevation = dataset.select('elevation');
  var hillshade = ee.Terrain.hillshade(elevation);
  var datasetVis = {
    min: 0.0,
    max: 255.0,
    gamma: 0.4,
    opacity: 0.25,
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
  ui.util.setTimeout(submitChangeAnalysis(SATELLITE_PROPERTIES[satelliteSelector.getValue()]), 2000);
}
ui.root.insert(0, leftPanel);
map.add(sliderPanel);
// ui.root.insert(1, sliderPanel);
map.add(legend);

// END OLD app.boot()

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////
// national forest unit names

// Allegheny National Forest
// Allegheny Purchase Unit
// Alpena S.F. Purchase Unit
// Angelina National Forest
// Apalachicola National Forest
// Au Sable Land Utilization Project
// Bayou Beouf Purchase Unit
// Bienville National Forest
// Black Kettle National Grassland
// Caddo National Grassland
// Cedar Creek Purchase Unit
// Chattahoochee National Forest
// Chattahoochee Purchase Unit
// Chequamegon National Forest
// Cherokee National Forest
// Cherokee Purchase Unit
// Chippewa National Forest
// Cimarron National Grassland
// Comanche National Grassland
// Conecuh National Forest
// Croatan National Forest
// Crossett Experimental Area
// Current River Purchase Unit
// Daniel Boone National Forest
// Davy Crockett National Forest
// De Soto National Forest
// De Soto Purchase Unit
// Delta National Forest
// Divided Mountain Purchase Unit
// Finger Lakes National Forest
// Forest Hydro. Lab. Experimental Area
// Forest I&D CT Lab. Experimental Area
// Forest I&D OH. Lab. Experimental Area
// Forest Prod. Marketing Lab. Experimental Area
// Forest Products Lab. Experimental Area
// Forestry Sci. GA. Lab. Experimental Area
// Forestry Sci. N.C. Lab. Experimental Area
// Francis Marion National Forest
// George Washington National Forest
// Gory Hole Cave Purchase Unit
// Green Mountain National Forest
// Green Mountain Other
// Hiawatha National Forest
// Holly Springs National Forest
// Homochitto National Forest
// Homochitto Purchase Unit
// Hoosier National Forest
// Hoosier Purchase Unit
// Huron National Forest
// Huron Purchase Unit
// Jefferson National Forest
// Kabetogama Purchase Unit
// Kimberling Creek Purchase Unit
// Kinkaid Lake Purchase Unit
// Kiowa National Grassland
// Kisatchie National Forest
// Land Between the Lakes Other
// Lincoln National Forest
// Lyndon B. Johnson National Grassland
// Manistee National Forest
// Mark Twain National Forest
// Mark Twain Purchase Unit
// Massabesic Experimental Forest
// McClellan Creek National Grassland
// Middle Mississippi Purchase Unit
// Midewin Other
// Military Hill Purchase Unit
// Monongahela National Forest
// Nantahala National Forest
// Nantahala Purchase Unit
// Nekoosa Purchase Unit
// Nicolet National Forest
// North Ewen Purchase Unit
// Northern Hardwood Lab Experimental Area
// Ocala National Forest
// Ocmulgee Purchase Unit
// Oconee National Forest
// Osceola National Forest
// Ottawa National Forest
// Ouachita National Forest
// Ozark National Forest
// Ozark Purchase Unit
// Paynesville Purchase Unit
// Pea River Land Utilization Project
// Pigeon River Purchase Unit
// Pinchot Inst. Other
// Pinhook Purchase Unit
// Pisgah National Forest
// Red Creek Purchase Unit
// Redbird Purchase Unit
// Richland Creek Purchase Unit
// Rita Blanca National Grassland
// Rose Purchase Unit
// Sabine National Forest
// Sam Houston National Forest
// Sewee Purchase Unit
// Shawnee National Forest
// Shawnee Purchase Unit
// South Ewen Purchase Unit
// Southern Hardwoods Lab Experimental Area
// St. Francis National Forest
// Stumpy Point Purchase Unit
// Sumter National Forest
// Superior National Forest
// Talladega National Forest
// Tombigbee National Forest
// Tuskegee National Forest
// Uwharrie National Forest
// Wayne National Forest
// Wayne Purchase Unit
// White Mountain National Forest
// White Mountain Purchase Unit
// William B. Bankhead National Forest
// Yonah Mountain Purchase Unit
// Bienville National Forest

/////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////

// maintenance

//   change version 640, title 641
//   change opening dates: pre, 816; post, 861
//   change from fs-export prompt x3 (default) to gen-user auto export x3, lines 61, 62

// national forest focus

//   uncomment 29+, 44
//   set map center and zoom, 65-67
//   change export geometry to nf, 7-sets of redirect, 1020-1262, 1787
