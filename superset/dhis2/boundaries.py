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
"""DHIS2 boundary fetching and caching service."""
import logging
from typing import Any, Dict, Optional

from flask import Blueprint, Response, jsonify, request
from flask_appbuilder import expose
from flask_appbuilder.api import BaseApi, safe
from flask_appbuilder.security.decorators import permission_name, protect

from superset import db
from superset.extensions import cache_manager, event_logger
from superset.models.core import Database
from superset.dhis2.geojson_utils import build_ou_parameter, convert_to_geojson

logger = logging.getLogger(__name__)

BOUNDARY_CACHE_TIMEOUT = 3600 * 24


class DHIS2BoundariesRestApi(BaseApi):
    """REST API for DHIS2 boundary data."""

    resource_name = "dhis2_boundaries"
    allow_browser_login = True
    openapi_spec_tag = "DHIS2 Boundaries"

    @expose("/<int:database_id>/", methods=["GET"])
    @protect()
    @safe
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: "dhis2_boundaries_fetch",
        log_to_statsd=False,
    )
    def get_boundaries(self, database_id: int) -> Response:
        """
        Fetch GeoJSON boundaries from DHIS2.

        Query Parameters:
        - level: Org unit level (1-6)
        - parent: Parent org unit UID
        - include_children: Include child boundaries
        - format: geojson (default) or topojson

        ---
        get:
          summary: Get DHIS2 boundaries
          parameters:
            - in: path
              name: database_id
              required: true
              schema:
                type: integer
              description: Database ID
            - in: query
              name: level
              schema:
                type: integer
                minimum: 1
                maximum: 6
              description: Organisation unit level
            - in: query
              name: parent
              schema:
                type: string
              description: Parent organisation unit UID
            - in: query
              name: include_children
              schema:
                type: boolean
                default: false
              description: Include child boundaries
            - in: query
              name: format
              schema:
                type: string
                enum: [geojson, topojson]
                default: geojson
              description: Output format
          responses:
            200:
              description: GeoJSON boundaries
              content:
                application/json:
                  schema:
                    type: object
            404:
              description: Database not found
            500:
              description: Failed to fetch boundaries
        """
        try:
            database = db.session.query(Database).get(database_id)
            if not database:
                return jsonify({"error": "Database not found"}), 404

            level = request.args.get("level", type=int)
            parent = request.args.get("parent", type=str)
            include_children = request.args.get("include_children", type=lambda x: x.lower() == "true", default=False)

            geojson_data = get_cached_boundaries(
                database_id=database_id,
                level=level,
                parent=parent,
                include_children=include_children,
                database=database,
            )

            return jsonify(geojson_data)
        except Exception as e:
            logger.exception(f"Error fetching boundaries for database {database_id}")
            return jsonify({"error": str(e)}), 500


def get_cached_boundaries(
    database_id: int,
    level: Optional[int] = None,
    parent: Optional[str] = None,
    include_children: bool = False,
    database: Optional[Database] = None,
) -> Dict[str, Any]:
    """
    Get boundaries from cache or fetch from DHIS2.

    Args:
        database_id: Superset database ID
        level: Organisation unit level
        parent: Parent organisation unit UID
        include_children: Include child boundaries
        database: Database object (optional, will be fetched if not provided)

    Returns:
        GeoJSON FeatureCollection dictionary
    """
    cache_key = f"dhis2_boundaries_{database_id}_{level}_{parent or 'root'}_{include_children}"

    cached = cache_manager.cache.get(cache_key)
    if cached:
        logger.info(f"Returning cached boundaries for {cache_key}")
        return cached

    if not database:
        database = db.session.query(Database).get(database_id)
        if not database:
            raise ValueError(f"Database {database_id} not found")

    boundaries = fetch_boundaries_from_dhis2(
        database=database,
        level=level,
        parent=parent,
        include_children=include_children,
    )

    cache_manager.cache.set(cache_key, boundaries, timeout=BOUNDARY_CACHE_TIMEOUT)
    return boundaries


def fetch_boundaries_from_dhis2(
    database: Database,
    level: Optional[int] = None,
    parent: Optional[str] = None,
    include_children: bool = False,
) -> Dict[str, Any]:
    """
    Fetch boundaries from DHIS2 instance.

    Args:
        database: Superset database object
        level: Organisation unit level
        parent: Parent organisation unit UID
        include_children: Include child boundaries

    Returns:
        GeoJSON FeatureCollection dictionary
    """
    try:
        from superset.db_engine_specs.dhis2 import DHIS2

        engine = database.get_sqla_engine()
        if not isinstance(engine.dialect, DHIS2):
            raise ValueError(f"Database {database.id} is not a DHIS2 instance")

        ou_param = build_ou_parameter(level, parent)

        geo_features = engine.dialect.fetch_geo_features(ou_param)

        geojson = convert_to_geojson(geo_features)

        return geojson

    except Exception as e:
        logger.exception(f"Failed to fetch boundaries from DHIS2")
        raise


def invalidate_boundary_cache(database_id: int) -> None:
    """Invalidate all boundary cache for a database."""
    try:
        from superset.cache import BaseCache

        if hasattr(cache_manager.cache, "cache"):
            cache_obj = cache_manager.cache.cache
            if isinstance(cache_obj, BaseCache):
                pattern = f"dhis2_boundaries_{database_id}_*"
                cache_obj.delete_mget(cache_obj.cache.keys(pattern))
    except Exception as e:
        logger.warning(f"Failed to invalidate boundary cache: {e}")
