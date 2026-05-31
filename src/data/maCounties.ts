import type { FeatureCollection, Polygon } from "geojson";

export const MA_COUNTIES: FeatureCollection<Polygon, { name: string; fips: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Suffolk", fips: "25025" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-71.193, 42.227],
          [-70.948, 42.232],
          [-70.918, 42.318],
          [-70.962, 42.397],
          [-71.064, 42.413],
          [-71.142, 42.391],
          [-71.184, 42.336],
          [-71.193, 42.227],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Norfolk", fips: "25021" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-71.498, 42.018],
          [-70.928, 42.012],
          [-70.918, 42.232],
          [-71.193, 42.227],
          [-71.281, 42.281],
          [-71.412, 42.262],
          [-71.498, 42.198],
          [-71.512, 42.108],
          [-71.498, 42.018],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Middlesex", fips: "25017" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-71.872, 42.412],
          [-71.142, 42.391],
          [-71.064, 42.413],
          [-70.962, 42.397],
          [-70.928, 42.512],
          [-71.012, 42.668],
          [-71.286, 42.728],
          [-71.621, 42.731],
          [-71.812, 42.692],
          [-71.872, 42.572],
          [-71.872, 42.412],
        ]],
      },
    },
  ],
};
