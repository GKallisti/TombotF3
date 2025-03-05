'use strict';

const fetch = require("node-fetch");

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
      let respuesta = JSON.stringify(event.payload);
      
      function sanitizeObject(obj) {
        if (typeof obj === 'string') {
          return obj.replace(/\r?\n/g, '').replace(/[^a-zA-Z0-9\s.,":{}[\]]+/g, '').trim();
        } else if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        } else if (typeof obj === 'object' && obj !== null) {
          return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, sanitizeObject(value)])
          );
        }
        return obj;
      }
      
      
      context.logger().info('params limpios: ' + sanitizeObject(respuesta));
      let params = sanitizeObject(respuesta);
      
      // Realizar la REST call con limit=5
      const url = "https://otmgtm-test-mycotm.otmgtm.us-ashburn-1.ocs.oraclecloud.com/logisticsRestApi/resources-int/v2/orderReleases?";
      const username = "ONET.INTEGRATIONTOMBOT";
      const password = "iTombot!1152025";
      const queryParams = new URLSearchParams(params);
      queryParams.append("limit", "5");
      const newurl = `${url}${queryParams.toString()}`;


      
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
        context.logger().info("Response from API: " + JSON.stringify(data));
        
        const orderIds = data.items ? data.items.map(item => item.orderReleaseXid).slice(0, 5) : [];
        const ordersclean = JSON.stringify(orderIds.join(", "))
        context.addMessage('The first 5 orders that meet that criteria are:' + ordersclean); 
        context.addMessage(ordersclean);
        if (orderIds.length === 0) {
          context.addMessage('No orders found.'); 
        }
        
        
      } catch (error) {
        context.logger().error("Error calling API: " + error.message);
      }
      
      if (errors.length > 0) {
        return context.handleInvalidResponse(errors);
      }
      return true;
    },

    changeBotMessages: async (event, context) => {
      return event.messages;
    },

    submit: async (event, context) => {
    }
  }
};