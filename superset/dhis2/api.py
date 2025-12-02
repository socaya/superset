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
"""DHIS2 REST API endpoints."""
import logging
from typing import Any

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import BaseApi, safe
from flask_appbuilder.security.decorators import permission_name, protect

from superset.extensions import event_logger

logger = logging.getLogger(__name__)


class DHIS2RestApi(BaseApi):
    """REST API for DHIS2 metadata and dataset building."""

    resource_name = "dhis2"
    allow_browser_login = True
    openapi_spec_tag = "DHIS2"

    @expose("/metadata/data-elements", methods=["GET"])
    @protect()
    @safe
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: "dhis2_metadata_fetch",
        log_to_statsd=False,
    )
    def get_data_elements(self) -> Response:
        """
        Fetch DHIS2 data elements (indicators, data elements, program indicators).

        ---
        get:
          summary: Get DHIS2 data elements
          parameters:
            - in: query
              name: database_id
              required: true
              schema:
                type: integer
              description: Database ID
            - in: query
              name: type
              schema:
                type: string
                enum: [all, indicators, dataElements, dataSets, programIndicators]
              description: Filter by element type
            - in: query
              name: search
              schema:
                type: string
              description: Search term
            - in: query
              name: page
              schema:
                type: integer
                default: 1
              description: Page number
            - in: query
              name: page_size
              schema:
                type: integer
                default: 50
              description: Items per page
          responses:
            200:
              description: Data elements retrieved
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      items:
                        type: array
                        items:
                          type: object
                      total:
                        type: integer
                      pager:
                        type: object
            400:
              description: Bad request
            404:
              description: Database not found
        """
        from superset.dhis2.metadata import get_metadata_fetcher

        database_id = request.args.get('database_id', type=int)
        if not database_id:
            return self.response_400(message="database_id is required")

        element_type = request.args.get('type', 'all')
        search = request.args.get('search')
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 50, type=int)

        fetcher = get_metadata_fetcher(database_id)
        if not fetcher:
            return self.response_404()

        try:
            result = fetcher.fetch_data_elements(element_type, search, page, page_size)
            return self.response(200, **result)
        except Exception as e:
            logger.error(f"Error fetching data elements: {e}")
            return self.response_500(message=str(e))

    @expose("/metadata/org-units", methods=["GET"])
    @protect()
    @safe
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: "dhis2_metadata_fetch",
        log_to_statsd=False,
    )
    def get_org_units(self) -> Response:
        """
        Fetch DHIS2 organization units.

        ---
        get:
          summary: Get DHIS2 organization units
          parameters:
            - in: query
              name: database_id
              required: true
              schema:
                type: integer
            - in: query
              name: level
              schema:
                type: integer
              description: Org unit level filter
            - in: query
              name: search
              schema:
                type: string
            - in: query
              name: page
              schema:
                type: integer
                default: 1
            - in: query
              name: page_size
              schema:
                type: integer
                default: 50
          responses:
            200:
              description: Org units retrieved
            400:
              description: Bad request
            404:
              description: Database not found
        """
        from superset.dhis2.metadata import get_metadata_fetcher

        database_id = request.args.get('database_id', type=int)
        if not database_id:
            return self.response_400(message="database_id is required")

        level = request.args.get('level', type=int)
        search = request.args.get('search')
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 50, type=int)

        fetcher = get_metadata_fetcher(database_id)
        if not fetcher:
            return self.response_404()

        try:
            result = fetcher.fetch_org_units(level, search, page, page_size)
            return self.response(200, **result)
        except Exception as e:
            logger.error(f"Error fetching org units: {e}")
            return self.response_500(message=str(e))

    @expose("/dataset/generate-sql", methods=["POST"])
    @protect()
    @safe
    @permission_name("read")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: "dhis2_generate_sql",
        log_to_statsd=False,
    )
    def generate_sql(self) -> Response:
        """
        Generate SQL query for DHIS2 dataset based on selected data elements.

        ---
        post:
          summary: Generate SQL for DHIS2 dataset
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    data_source:
                      type: string
                      enum: [analytics, dataValueSets, events, trackedEntityInstances]
                    data_element_ids:
                      type: array
                      items:
                        type: string
                    periods:
                      type: array
                      items:
                        type: string
                    org_units:
                      type: array
                      items:
                        type: string
                    filters:
                      type: object
          responses:
            200:
              description: SQL generated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      sql:
                        type: string
                      comment:
                        type: string
            400:
              description: Bad request
        """
        data = request.json
        if not data:
            return self.response_400(message="Request body is required")

        data_source = data.get('data_source', 'analytics')
        data_element_ids = data.get('data_element_ids', [])
        periods = data.get('periods', [])
        org_units = data.get('org_units', [])

        if not data_element_ids:
            return self.response_400(message="At least one data element must be selected")

        # Generate DHIS2 API parameters for SQL comment
        dimension_params = []
        if data_element_ids:
            dimension_params.append(f"dx:{';'.join(data_element_ids)}")
        if periods:
            dimension_params.append(f"pe:{';'.join(periods)}")
        if org_units:
            dimension_params.append(f"ou:{';'.join(org_units)}")

        dimension_str = '&dimension='.join(dimension_params) if dimension_params else ''

        # Generate SQL based on data source
        if data_source == 'analytics':
            sql_comment = f"-- DHIS2: dimension={dimension_str}&displayProperty=NAME&skipMeta=false"
            sql_query = f"{sql_comment}\nSELECT * FROM analytics LIMIT 10000"

        elif data_source == 'dataValueSets':
            sql_comment = f"-- DHIS2 DataValueSets: dataElement={';'.join(data_element_ids)}"
            where_clauses = []
            if data_element_ids:
                where_clauses.append(f"dataElement IN ({', '.join(repr(de) for de in data_element_ids)})")
            if periods:
                where_clauses.append(f"period IN ({', '.join(repr(p) for p in periods)})")

            where_clause = ' AND '.join(where_clauses) if where_clauses else '1=1'
            sql_query = f"{sql_comment}\nSELECT * FROM dataValueSets WHERE {where_clause} LIMIT 10000"

        elif data_source == 'events':
            sql_comment = f"-- DHIS2 Events"
            sql_query = f"{sql_comment}\nSELECT * FROM events LIMIT 10000"

        else:
            return self.response_400(message=f"Unsupported data source: {data_source}")

        return self.response(200, sql=sql_query, comment=sql_comment)
