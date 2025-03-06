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
      let rawParams = event.payload;
      let params = {};

      // Si el payload ya es un string sin JSON, lo usamos como el valor de 'q'
      if (typeof rawParams === "string" && !rawParams.trim().startsWith("{") && !rawParams.trim().startsWith("[")) {
        params.q = rawParams.trim(); 
      } else {
        try {
          params = JSON.parse(rawParams); // Intentar parsear JSON si es posible
        } catch (e) {
          context.logger().error("Error parsing params: " + e.message);
          params = {}; // Si falla, se usa un objeto vacío
        }
      }

      // Asegurar que los valores en params.q conserven comillas dobles
      if (params.q) {
        params.q = params.q.replace(/\\"/g, '"'); // Reemplazar \" por "
      }

      // Construcción manual de la URL con parámetros
      const url = "https://otmgtm-test-mycotm.otmgtm.us-ashburn-1.ocs.oraclecloud.com/logisticsRestApi/resources-int/v2/orderReleases";
      const username = "ONET.INTEGRATIONTOMBOT";
      const password = "iTombot!1152025";
      const queryParams = `q=${encodeURIComponent(params.q)}&limit=5`;
      const newurl = `${url}?${queryParams}`;

      context.logger().info("URL final construida: " + newurl);
      
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
        const ordersclean = JSON.stringify(orderIds.join(", "));
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
