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
      
      let endpoint;
      switch (Intentname) {
        case "ORsearch":
          endpoint = "/orderReleases";
          break;
        case "ShipmentSearch":
          endpoint = "/shipments";
          break;
        case "InvoiceSearch":
          endpoint = "/invoices";
          break;
        default:
          endpoint = "/orderReleases"; // Fallback en caso de intent desconocido
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
          let itemCount = items.length;
          let itemList;
          switch (Intentname) {
            case "ORsearch":
              itemList = items.map(item => item.orderReleaseXid).join(", ");
              break;
            case "ShipmentSearch":
              itemList = items.map(item => item.shipmentXid).join(", ");
              break;
            case "InvoiceSearch":
              itemList = items.map(item => item.invoiceXid).join(", ");
              break;
            default:
              itemList = "No relevant data found.";
          }
          
          if (itemCount < 5) {
            responseText = `Only ${itemCount} result(s) found: ${itemList}`;
          } else {
            responseText = `The first 5 results that meet that criteria are: ${itemList}`;
          }
        } else {
          responseText = "No records found with those filters.";
        }

        apiResponse = responseText;
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
