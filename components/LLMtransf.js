'use strict';

// Documentation for writing LLM Transformation handlers: https://github.com/oracle/bots-node-sdk/blob/master/LLM_TRANSFORMATION_HANDLER.md

// You can use your favorite http client package to make REST calls, however, the node fetch API is pre-installed with the bots-node-sdk.
// Documentation can be found at https://www.npmjs.com/package/node-fetch
// Un-comment the next line if you want to make REST calls using node-fetch.
const fetch = require("node-fetch");
const { LlmTransformationContext, TransformPayloadEvent } = require ('@oracle/bots-node-sdk/typings/lib2');

module.exports = {
  metadata: {
    name: 'LLMTf',
    eventHandlerType: 'LlmTransformation'
  },
  handlers: {

    /**
    * Handler to transform the request payload
    * @param {TransformPayloadEvent} event - event object contains the following properties:
    * - payload: the request payload object
    * @param {LlmTransformationContext} context - see https://oracle.github.io/bots-node-sdk/LlmTransformationContext.html
    * @returns {object} the transformed request payload
    */
     transformRequestPayload: async (event, context) => {
      // NOTE: Depending on the Cohere version, this code might need to be updated

      // Cohere doesn't support chat completions, so we first print the system prompt, and if there
      // are additional chat entries, we add these to the system prompt under the heading CONVERSATION HISTORY
      let prompt = event.payload.messages[0].content;
      if (event.payload.messages.length > 1) {
         let history = event.payload.messages.slice(1).reduce((acc, cur) => `${acc}\n${cur.role}: ${cur.content}` , '');
         prompt += `\n\nCONVERSATION HISTORY:${history}\nassistant:`
      }
      return {
        "max_tokens": event.payload.maxTokens,
        "truncate": "END",
        "return_likelihoods": "NONE",
        "prompt": prompt,
        "model": "command",
        "temperature": event.payload.temperature,
        "stream": event.payload.streamResponse,
        "streamResponse": false

      };
    },

    /**
    * Handler to transform the response payload
    * @param {TransformPayloadEvent} event - event object contains the following properties:
    * - payload: the response payload object
    * @param {LlmTransformationContext} context - see https://oracle.github.io/bots-node-sdk/LlmTransformationContext.html
    * @returns {object} the transformed response payload
    */
    transformResponsePayload: async (event, context) => {
      let llmPayload = {};
      if (event.payload.responseItems) {
        // streaming case
        llmPayload.responseItems = [];
        event.payload.responseItems.forEach(item => {
          llmPayload.responseItems.push({"candidates": [{"content": item.text || "" }]});
        });
      } else {
        // non-streaming
        llmPayload.candidates = event.payload.inferenceResponse.generatedTexts.map( item => {return {"content": item.text || "" };});
      }
      return llmPayload;
    },

    /**
    * Handler to transform the error response payload, invoked when HTTP status code is 400 or higher and the error
    * response body received is a JSON object
    * @param {TransformPayloadEvent} event - event object contains the following properties:
    * - payload: the error response payload object
    * @param {LlmTransformationContext} context - see https://oracle.github.io/bots-node-sdk/LlmTransformationContext.html
    * @returns {object} the transformed error response payload
    */
    transformErrorResponsePayload: async (event, context) => {
      const error = event.payload.message || 'unknown error';
      if (error.startsWith('invalid request: total number of tokens')) {
        // returning modelLengthExceeded error code will cause a retry with reduced chat history
        return {"errorCode" : "modelLengthExceeded", "errorMessage": error};
      } else {
        return {"errorCode" : "unknown", "errorMessage": error};
      }
    }

  }
};