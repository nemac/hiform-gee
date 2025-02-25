const currentDate = new Date().toISOString().split("T")[0];
export const agolApiKey =
  "AAPTxy8BH1VEsoebNVZXo8HurJ1l5XMjzJo3q5NLa3y61GKO6k3KPMl1jafmYsRFusMfVVhCmkhTEAwt-o-k9J-YkCco-twebgNy-boj2EhUvSUQ5kbA9OzhICpj0S7FrIXBLcEgsRa6PpfEbMyDLeRv4-HN13QnLI2fffNHO6HVD4kFMx5nZ4z_wNgpzPbDxNnOiBccDHyLYyDkHD59BwcyKXwmJUL46z-nffTKKY6X6Ns.AT1_cbo7LRt6";
export const basemaps = {
  "ArcGIS Dark Gray": {
    name: "ArcGIS Dark Gray",
    description: "ArcGIS Dark Gray",
    basemap: "arcgis/dark-gray",
  },
  "ArcGIS Light Gray": {
    name: "ArcGIS Light Gray",
    description: "ArcGIS Light Gray",
    basemap: "arcgis/light-gray",
  },
  "ArcGIS Imagery": {
    name: "ArcGIS Imagery",
    description: "ArcGIS Imagery",
    basemap: "arcgis/imagery",
  },
};
export const satellites = {
  "Landsat 8 Real-Time": {
    label: "Landsat 8 Real-Time",
    satellite: "LANDSAT/LC08/C02/T1_RT_TOA",
    bands: {
      blue: "B2",
      green: "B3",
      red: "B4",
      nir: "B5",
      swir1: "B6",
      swir2: "B7",
    },
    scale: 30,
    min: 0.03,
    max: 0.2,
    startDate: "2013-03-18",
    endDate: currentDate,
  },
  "Sentinel 2 TOA": {
    label: "Sentinel 2 TOA",
    satellite: "COPERNICUS/S2_HARMONIZED",
    scale: 10,
    bands: {
      blue: "B2",
      green: "B3",
      red: "B4",
      nir: "B8",
      "red edge 4": "B8A",
      cirrus: "B10",
      swir1: "B11",
      swir2: "B12",
      ndvi: "NDVI",
    },
    falseAgMin: 0,
    falseAgMax: 0.4,
    min: 300,
    max: 1500,
    startDate: "2015-06-23",
    endDate: currentDate,
  },
  "Sentinel 2 SR": {
    label: "Sentinel 2 SR",
    satellite: "COPERNICUS/S2_SR_HARMONIZED",
    scale: 10,
    bands: {
      blue: "B2",
      green: "B3",
      red: "B4",
      nir: "B8",
      "red edge 4": "B8A",
      cirrus: "B10",
      swir1: "B11",
      swir2: "B12",
      ndvi: "NDVI",
    },
    falseAgMin: 0,
    falseAgMax: 0.4,
    min: 300,
    max: 1500,
    startDate: "2017-03-28",
    endDate: currentDate,
  },
  "Sentinel 3": {
    label: "Sentinel 3",
    satellite: "COPERNICUS/S3/OLCI",
    bands: {
      blue: "Oa04_radiance",
      green: "Oa06_radiance",
      red: "Oa08_radiance",
      nir: "Oa17_radiance",
    },
    min: 15,
    max: 70,
    startDate: "2016-10-18",
    endDate: currentDate,
  },
  // The combined objects below have this weirdish looking thing for the "bands" key but it's
  // done this way so we don't have to rewrite everything else. Essentially the "sat0Bands" and "sat1Bands"
  // objects help the combiner resolve what band is associated with what and then the "bands"
  // object exists so other functions that look up key.bands don't have to be rewritten just for combined
  // satellites. e.g. key.bands.blue returns "blue" instead of "B1" and the visualizer resolves it just fine
  "L5/L8 TOA Combined": {
    label: "L5/L8 TOA Combined",
    combined: true,
    keys: ["Landsat 5 TOA", "Landsat 8 TOA"],
    sat0: "LANDSAT/LT05/C02/T1_TOA",
    sat0Bands: {
      blue: "B1",
      green: "B2",
      red: "B3",
      nir: "B4",
      swir1: "B5",
      swir2: "B7",
    },
    sat1: "LANDSAT/LC08/C02/T1_TOA",
    sat1Bands: {
      blue: "B2",
      green: "B3",
      red: "B4",
      nir: "B5",
      swir1: "B6",
      swir2: "B7",
    },
    bands: {
      blue: "blue",
      green: "green",
      red: "red",
      nir: "nir",
      swir1: "swir1",
      swir2: "swir2",
    },
    startDate: "1984-03",
    endDate: currentDate,
    scale: 30,
    min: 0,
    max: 0.4,
  },
  "L5/L8 SR Combined": {
    label: "L5/L8 SR Combined",
    combined: true,
    keys: ["Landsat 5 SR", "Landsat 8 SR"],
    sat0: "LANDSAT/LT05/C02/T1_L2",
    sat0Bands: {
      blue: "SR_B1",
      green: "SR_B2",
      red: "SR_B3",
      nir: "SR_B4",
      swir1: "SR_B5",
      swir2: "SR_B7",
    },
    sat1: "LANDSAT/LC08/C02/T1_L2",
    sat1Bands: {
      blue: "SR_B2",
      green: "SR_B3",
      red: "SR_B4",
      nir: "SR_B5",
      swir1: "SR_B6",
      swir2: "SR_B7",
    },
    bands: {
      blue: "blue",
      green: "green",
      red: "red",
      nir: "nir",
      swir1: "swir1",
      swir2: "swir2",
    },
    startDate: "1984-03",
    endDate: currentDate,
    scale: 30,
    min: 5000,
    max: 15000,
  },
  "L8/L9 TOA Combined": {
    label: "L8/L9 TOA Combined",
    combined: true,
    keys: ["Landsat 8 TOA", "Landsat 9 TOA"],
    sat0: "LANDSAT/LC08/C02/T1_TOA",
    sat0Bands: {
      blue: "B2",
      green: "B3",
      red: "B4",
      nir: "B5",
      swir1: "B6",
      swir2: "B7",
    },
    sat1: "LANDSAT/LC09/C02/T1_TOA",
    sat1Bands: {
      blue: "B2",
      green: "B3",
      red: "B4",
      nir: "B5",
      swir1: "B6",
      swir2: "B7",
    },
    bands: {
      blue: "blue",
      green: "green",
      red: "red",
      nir: "nir",
      swir1: "swir1",
      swir2: "swir2",
    },
    startDate: "2013",
    endDate: currentDate,
    scale: 30,
    min: 0,
    max: 0.4,
  },
  "L8/L9 SR Combined": {
    label: "L8/L9 SR Combined",
    combined: true,
    sat0: "LANDSAT/LC08/C02/T1_L2",
    sat0Bands: {
      blue: "SR_B2",
      green: "SR_B3",
      red: "SR_B4",
      nir: "SR_B5",
      swir1: "SR_B6",
      swir2: "SR_B7",
    },
    sat1: "LANDSAT/LC09/C02/T1_L2",
    sat1Bands: {
      blue: "SR_B2",
      green: "SR_B3",
      red: "SR_B4",
      nir: "SR_B5",
      swir1: "SR_B6",
      swir2: "SR_B7",
    },
    bands: {
      blue: "blue",
      green: "green",
      red: "red",
      nir: "nir",
      swir1: "swir1",
      swir2: "swir2",
    },
    startDate: "2013",
    endDate: currentDate,
    scale: 30,
    min: 5000,
    max: 15000,
  },
};

export const sldIntervalsAbsoluteNdvi =
  "<RasterSymbolizer>" +
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
  "</ColorMap>" +
  "</RasterSymbolizer>";

export const cloudThresholds = {
  Low: { label: "Low", value: 0.65 },
  Medium: { label: "Medium", value: 0.725 },
  High: { label: "High", value: 0.8 },
};
