# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""GeoJSON utilities for DHIS2 boundary data."""
import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def convert_to_geojson(geo_features: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Convert DHIS2 geoFeatures response to standard GeoJSON FeatureCollection.

    Args:
        geo_features: List of geoFeature objects from DHIS2

    Returns:
        GeoJSON FeatureCollection dictionary
    """
    features = []

    for gf in geo_features:
        try:
            coordinates = json.loads(gf.get("co", "[]"))
        except (json.JSONDecodeError, TypeError):
            logger.warning(f"Failed to parse coordinates for feature {gf.get('id')}")
            coordinates = []

        geo_type = {
            1: "Point",
            2: "Polygon",
            3: "MultiPolygon",
        }.get(gf.get("ty", 2), "Polygon")

        feature = {
            "type": "Feature",
            "id": gf.get("id"),
            "properties": {
                "id": gf.get("id"),
                "name": gf.get("na"),
                "level": gf.get("le"),
                "parentId": gf.get("pi"),
                "parentName": gf.get("pn"),
                "hasChildrenWithCoordinates": gf.get("hcd", False),
                "hasParentWithCoordinates": gf.get("hcu", False),
            },
            "geometry": {
                "type": geo_type,
                "coordinates": coordinates,
            },
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def build_ou_parameter(level: int | None, parent: str | None) -> str:
    """
    Build organisation unit parameter for DHIS2 API.

    Args:
        level: Organisation unit level (1-6)
        parent: Parent organisation unit UID

    Returns:
        Properly formatted OU parameter string
    """
    if parent:
        return parent
    elif level:
        return f"ou:LEVEL-{level}"
    else:
        return "ou:USER_ORGUNIT"
