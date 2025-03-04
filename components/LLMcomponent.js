'use strict';

// Documentation for writing LLM component handlers: https://github.com/oracle/bots-node-sdk/blob/master/LLM_COMPONENT_HANDLER.md

// You can use your favorite http client package to make REST calls, however, the node fetch API is pre-installed with the bots-node-sdk.
// Documentation can be found at https://www.npmjs.com/package/node-fetch
// Un-comment the next line if you want to make REST calls using node-fetch.
const fetch = require("node-fetch");

module.exports = {
  metadata: {
    name: 'LLMH',
    eventHandlerType: 'LlmComponent'
  },
  handlers: {

    /**
    * Handler to validate the request payload
    * @param {ValidateRequestEvent} event - event object contains the following properties:
    * - payload: the request payload object
    * @param {LlmComponentContext} context - see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
    * @returns {boolean} returns true when payload is valid
    */
    validateRequestPayload: async (event, context) => {



      if (context.getCurrentTurn() === 1 && context.isJsonValidationEnabled()) {
        context.addJSONSchemaFormattingInstruction();
      }
      return true;
    },

    /**
    * Handler to validate the response payload
    * @param {ValidateResponseEvent} event - event object contains the following properties:
    * - payload: the response payload object
    * - validationEntities: List of entity names that is specified in the 'Validation Entities' property of
    *   the corresponding LLM state in the visual flow diagrammer.
    * - entityMatches: key-value pairs with the entityName as key and a list of matches as value. This property is only set
    *   when the 'Validation Entities' property is set in the LLM state.
    * - entityValidationErrors: key-value pairs with the entityName or composite bag item as key and an error message as value.
    *   This property is only set when the 'Validation Entities' property is set, and there are missing entity matches or
    *   missing composite bag item matches when the entity is a composite bag entity.
    * - jsonValidationErrors: if the jsonValidation property is true, and the response is not a valid JSON object, this property
    *   contains a single entry with the error message stating the response is not a valid JSON object. If the response is valid
    *   JSON and the 'JSON Schema' property is set, this property contains key-value pairs with the schema path as key and the
    *   schema validation error message as value, when the response doesn't comply with the schema.
    * - allValidationErrors: List of all entity validation errors and JSON validation errors.
    * @param {LlmComponentContext} context - see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
    * @returns {boolean} returns true when payload is valid
    */
    validateResponsePayload: async (event, context) => {
      let errors = event.allValidationErrors || [];
      let respuesta = JSON.stringify(event.payload);
      function sanitizeObject(obj) {
        if (typeof obj === 'string') {
            return obj
                .replace(/[\r\n]/g, '').replace(/[^a-zA-Z0-9\s.]/g, '').replace(/n+$/, ''); 
        } else if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        } else if (typeof obj === 'object' && obj !== null) {
            return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [key, sanitizeObject(value)])
            );
        }
        return obj;
    }
      context.logger().info('la puta madre:' + sanitizeObject(respuesta) );
      

      if (errors.length > 0) {
        return context.handleInvalidResponse(errors);
      }
      return true;
    },

    /**
    * Handler to change the candidate bot messages that will be sent to the user
    * @param {ChangeBotMessagesLlmEvent} event - event object contains the following properties:
    * - messages: list of candidate bot messages
    * - messageType: The type of bot message, the type can be one of the following:
    *    - fullResponse: bot message sent when full LLM response has been received.
    *    - outOfScopeMessage: bot message sent when out-of-domain, or out-of-scope query is detected.
    *    - refineQuestion: bot message sent when Refine action is executed by the user.
    * @param {LlmComponentContext} context - see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
    * @returns {NonRawMessage[]} returns list of bot messages
    */
    changeBotMessages: async (event, context) => {
      return event.messages;
    },

    /**
    * Handler that fires when the Submit action is executed by the user.
    * Use this handler to add your custom logic to process the LLM response.
    * @param {SubmitEvent} event
    * @param {LlmComponentContext} context - see https://oracle.github.io/bots-node-sdk/LlmComponentContext.html
    */
    submit: async (event, context) => {
    }

  }
};