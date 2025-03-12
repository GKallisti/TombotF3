'use strict';
const { LlmTransformationContext, TransformPayloadEvent } = require ('@oracle/bots-node-sdk/typings/lib2');
const fetch = require("node-fetch");
const { messageFromJson } = require('@oracle/bots-node-sdk/typings/lib2/messagev2/messageFactory');

module.exports = {
  metadata: {
    name: 'LLMH',
    eventHandlerType: 'LlmComponent'
  },
  handlers: {
    validateRequestPayload: async (event, context) => {
      if (context.getCurrentTurn() === 1 && context.isJsonValidationEnabled()) {
        context.addJSONSchemaFormattingInstruction();
      }
      return true;
    },

    validateResponsePayload: async (event, context) => {
      let errors = event.allValidationErrors || [];
      let rawParams = event.payload;
      let params = {};

      let Intentname = context.getVariable("Intentname");
      context.logger().info("Intentname: " + Intentname);

      let endpoint, objectType;
      switch (Intentname) {
        case "ORsearch":
          endpoint = "/orderReleases";
          objectType = "order releases";
          break;
        case "ShipmentSearch":
          endpoint = "/shipments?expand=statuses,sEquipments";
          objectType = "shipments";
          break;
        case "InvoiceSearch":
          endpoint = "/invoices";
          objectType = "invoices";
          break;
        default:
          endpoint = "/orderReleases";
          objectType = "records"; 
      }

      if (typeof rawParams === "string" && !rawParams.trim().startsWith("{") && !rawParams.trim().startsWith("[")) {
        params.q = rawParams.trim(); 
      } else {
        try {
          params = JSON.parse(rawParams);
        } catch (e) {
          context.logger().error("Error parsing params: " + e.message);
          params = {};
        }
      }

      if (params.q) {
        params.q = params.q.replace(/\\"/g, '"');
      }

      const baseUrl = "https://otmgtm-test-mycotm.otmgtm.us-ashburn-1.ocs.oraclecloud.com/logisticsRestApi/resources-int/v2";
      const username = "ONET.INTEGRATIONTOMBOT";
      const password = "iTombot!1152025";
      const queryParams = `q=${encodeURIComponent(params.q)}&limit=5`;
      const newurl = `${baseUrl}${endpoint}?${queryParams}`;

      context.logger().info("URL final construida: " + newurl);

      // Funciones de mapeo por tipo
      function mapShipment(item) {
        let shipmentId = item.shipmentXid || "Unknown ID";
        let enrouteStatusValueGid = "Unknown";
        if (item.statuses && Array.isArray(item.statuses.items)) {
          let enrouteStatus = item.statuses.items.find(status => status.statusTypeGid === "ONET.ENROUTE");
          enrouteStatusValueGid = enrouteStatus ? enrouteStatus.statusValueGid : "Unknown";
        }
        let equipmentXid = "No Equipment";
        if (item.sEquipments && Array.isArray(item.sEquipments.items) && item.sEquipments.items.length > 0) {
          // Se busca el primer sEquipment que tenga sEquipmentXid
          let equipment = item.sEquipments.items.find(eq => eq.sEquipment && eq.sEquipment.sEquipmentXid);
          equipmentXid = equipment ? equipment.sEquipment.sEquipmentXid : "No Equipment";
        } else if (item.sEquipments && Array.isArray(item.sEquipments) && item.sEquipments.length > 0) {
          equipmentXid = item.sEquipments[0].equipmentXid || "No Equipment";
        }
        return `${shipmentId} (Status Value GID: ${enrouteStatusValueGid}, Equipment: ${equipmentXid})`;
      }

      function mapInvoice(item) {
        let invoiceId = item.invoiceXid || "Unknown Invoice ID";
        let servprovAliasValue = item.servprovAliasValue || "Unknown Provider";
        let netAmountDueStr = "No Amount";
        if (item.netAmountDue) {
          netAmountDueStr = `${item.netAmountDue.value} ${item.netAmountDue.currency}`;
        }
        return `${invoiceId} (Provider: ${servprovAliasValue}, Amount Due: ${netAmountDueStr})`;
      }

      function mapOrderRelease(item) {
        return item.orderReleaseXid || "Unknown Order Release ID";
      }

      // Seleccionar función de mapeo según el intent
      let mapFunction;
      if (Intentname === "ShipmentSearch") {
        mapFunction = mapShipment;
      } else if (Intentname === "InvoiceSearch") {
        mapFunction = mapInvoice;
      } else if (Intentname === "ORsearch") {
        mapFunction = mapOrderRelease;
      } else {
        mapFunction = item => JSON.stringify(item);
      }

      let apiResponse;
      try {
        const response = await fetch(newurl, {
          method: "GET",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const items = data.items ? data.items.slice(0, 5) : [];

        let responseText;
        if (items.length > 0) {
          let itemDetails = items.map(item => mapFunction(item)).join("; ");
          responseText = `The first ${items.length} ${objectType} that meet that criteria are: ${itemDetails}.`;
        } else {
          responseText = `No ${objectType} found with those filters.`;
        }

        apiResponse = responseText;
        context.logger().info("Text response: " + responseText);

      } catch (error) {
        context.logger().error("Error calling API: " + error.message);
        apiResponse = "An error occurred while fetching data.";
      }

      context.variable('apiResponse', apiResponse);
      context.logger().info("API response: " + apiResponse);
      if (errors.length > 0) {
        return context.handleInvalidResponse(errors);
      }
      return true;
    },

    changeBotMessages: async (event, context) => {
      if (event.messageType === 'fullResponse') {
        const mf = context.getMessageFactory();
        const messageText = context.variable('apiResponse') || "No response available.";
        const message = mf.createTextMessage(messageText);
        context.logger().info("Message: " + messageText);
        context.logger().info(JSON.stringify(event));
        event.messages.push(message);
      }
      return event.messages;
    },

    submit: async (event, context) => {
    }
  }
};
