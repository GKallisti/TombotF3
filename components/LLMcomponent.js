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
    let itemDetails = items.map(item => {
        let shipmentId = item.shipmentXid || "Unknown ID";
        let enrouteStatusValueGid = "Unknown";
        
        // Verificamos si statuses.items existe y es un array, y buscamos el estado ENROUTE
        if (item.statuses && Array.isArray(item.statuses.items)) {
            let enrouteStatus = item.statuses.items.find(status => status.statusTypeGid === "ONET.ENROUTE");
            enrouteStatusValueGid = enrouteStatus ? enrouteStatus.statusValueGid : "Unknown";
        }
    
        // Corrección de la obtención de sEquipments
        let equipmentXid;
        if (item.sEquipments && Array.isArray(item.sEquipments.items)) {
            let equipment = item.sEquipments.items.find(sEquipments => sEquipments.sEquipment && sEquipments.sEquipment.sEquipmentXid);
            equipmentXid = equipment ? equipment.sEquipment.sEquipmentXid : "No Equipment";
        }
    
        return `${shipmentId} (Status Value GID: ${enrouteStatusValueGid}, Equipment: ${equipmentXid})`;
    }).join("; ");
    
    // Ajustamos el mensaje para que muestre la cantidad correcta de elementos
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
