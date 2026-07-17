#!/usr/bin/python

# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0
#
# ---------------------------------------------------------------------------
# FeatBit-instrumented variant of the OpenTelemetry Demo llm service
# (otel-demo 2.2.0 base). Differences from upstream:
#   * The flagd / OpenFeature integration is replaced with FeatBit's native
#     Python server SDK (see featbit_client.py). The flagd `check_feature_flag`
#     helper and its `llmInaccurateResponse` chaos flag are removed.
#   * Three realistic, production-style feature flags drive behavior, each with
#     a safe default:
#       - operational-ai-assistant-enabled  (ops/kill-switch, bool, default true)
#       - release-streaming-responses       (release gate,     bool, default false)
#       - experiment-llm-model              (experiment,       str,  default "default")
#   * flag-not-found / eval-server-down are non-breaking (defaults are served).
#     A *misconfigured* experiment-llm-model value (unknown variant) is passed
#     through to an unchecked dict lookup, surfacing the application's missing
#     variant validation as an intentional resiliency gap.
# ---------------------------------------------------------------------------

from flask import Flask, request, jsonify
import json
import time
import re
import logging

from opentelemetry import trace

import featbit_client

app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# Experiment variant -> concrete model id. "default" plus the known variants are
# safe. An UNRECOGNIZED variant intentionally raises KeyError on the unchecked
# lookup below, surfacing the missing variant validation when the experiment
# flag is misconfigured.
MODEL_VARIANTS = {
    "default": "astronomy-llm",
    "fast": "astronomy-llm-fast",
    "accurate": "astronomy-llm-accurate",
}

product_review_summaries = None
product_review_summaries_file_path = "./product-review-summaries.json"


def load_product_review_summaries(file_path):
    try:
        with open(file_path, 'r') as file:

            """
            Converts a JSON string into an internal dictionary optimized for quick lookups.
            The keys of the internal dictionary will be product_ids.
            """
            try:
                data = json.load(file)
                summaries = data.get("product-review-summaries", [])

                # Create a dictionary where product_id is the key
                # and the value is the summary
                product_review_summaries = {}
                for product in summaries:
                    product_id = product.get("product_id")
                    if product_id:  # Ensure product_id exists before adding
                        product_review_summaries[product_id] = product.get("product_review_summary")
                return product_review_summaries
            except json.JSONDecodeError:
                print("Error: Invalid JSON string provided during initialization.")
                return {}

    except FileNotFoundError:
        app.logger.error(f"Error: The file '{product_review_summaries_file_path}' was not found.")
    except json.JSONDecodeError:
        app.logger.error(f"Error: Failed to decode JSON from the file '{product_review_summaries_file_path}'. Check for malformed JSON.")
    except Exception as e:
        app.logger.error(f"An unexpected error occurred: {e}")


def generate_response(product_id):
    """Generate a response by providing the pre-generated summary for the specified product"""
    product_review_summary = product_review_summaries.get(product_id)

    app.logger.info(f"product_review_summary is: {product_review_summary}")

    return product_review_summary


def parse_product_id(last_message):
    match = re.search(r"product ID:([A-Z0-9]+)", last_message)
    if match:
        return match.group(1).strip()

    match = re.search(r"product ID, but make the answer inaccurate:([A-Z0-9]+)", last_message)
    if match:
        return match.group(1).strip()

    raise ValueError("product ID not found in input message")


@app.route('/v1/chat/completions', methods=['POST'])
def chat_completions():
    data = request.json
    messages = data.get('messages', [])
    stream = data.get('stream', False)
    model = data.get('model', 'astronomy-llm')
    tools = data.get('tools', None)

    span = trace.get_current_span()

    # --- Experiment flag: A/B model selection -------------------------------
    # The flag value is recorded faithfully on the span. The model id is then
    # resolved through an UNCHECKED dict lookup: an unknown variant raises
    # KeyError (a real error), intentionally surfacing the missing variant
    # validation when the experiment flag is misconfigured. "default" and the
    # known variants are safe.
    experiment_model = featbit_client.llm_model()
    span.set_attribute("app.llm.experiment_model", experiment_model)
    model = MODEL_VARIANTS[experiment_model]
    span.set_attribute("app.llm.model", model)

    # --- Release flag: streaming responses ----------------------------------
    # Release gate; safe either way. Recorded on the span and used to pick the
    # response branch below.
    streaming_enabled = featbit_client.streaming_responses_enabled()
    span.set_attribute("app.llm.streaming_enabled", streaming_enabled)

    # --- Ops/kill-switch flag: AI assistant generation ----------------------
    # Cost/outage control. When disabled, return a graceful canned response
    # instead of generating. Safe either way.
    assistant_enabled = featbit_client.ai_assistant_enabled()
    span.set_attribute("app.llm.assistant_enabled", assistant_enabled)
    if not assistant_enabled:
        app.logger.info("AI assistant disabled via operational-ai-assistant-enabled; returning canned response")
        response_text = 'The AI shopping assistant is temporarily unavailable. Please try again later.'
        return build_response(model, messages, response_text)

    app.logger.info(f"Received a chat completion request: '{messages}'")

    last_message = messages[-1]["content"]

    app.logger.info(f"last_message is: '{last_message}'")

    if 'What age(s) is this recommended for?' in last_message:
        response_text = 'This product is recommended for ages 7 and above.'
        return build_response(model, messages, response_text)
    elif 'Were there any negative reviews?' in last_message:
        response_text = 'No, there were no reviews less than three stars for this product.'
        return build_response(model, messages, response_text)
    elif not ('Can you summarize the product reviews?' in last_message or 'Based on the tool results, answer the original question about product ID' in last_message):
        response_text = 'Sorry, I\'m not able to answer that question.'
        return build_response(model, messages, response_text)

    # otherwise, process the product review summary
    product_id = parse_product_id(last_message)

    if tools is not None:

        tool_args = f"{{\"product_id\": \"{product_id}\"}}"

        app.logger.info(f"Processing a tool call with args: '{tool_args}'")

        app.logger.info(f"The model is: {model}")
        if model.endswith("rate-limit"):
            app.logger.info(f"Returning a rate limit error")
            response = {
                "error": {
                    "message": "Rate limit reached. Please try again later.",
                    "type": "rate_limit_exceeded",
                    "param": "null",
                    "code": "null"
                }
            }
            return jsonify(response), 429
        else:
            # Non-streaming response
            response = {
                "id": f"chatcmpl-mock-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "requesting a tool call",
                        "tool_calls": [{
                            "id": "call",
                            "type": "function",
                            "function": {
                                "name": "fetch_product_reviews",
                                "arguments": tool_args
                            }
                        }]
                    },
                    "finish_reason": "tool_calls"
                }],
                "usage": {
                    "prompt_tokens": sum(len(m.get("content", "").split()) for m in messages),
                    "completion_tokens": "0",
                    "total_tokens": sum(len(m.get("content", "").split()) for m in messages)
                }
            }
            return jsonify(response)

    else:
        # Generate the response
        response_text = generate_response(product_id)

        return build_response(model, messages, response_text, streaming_enabled)


def build_response(model, messages, response_text, streaming_enabled=False):
    app.logger.info(f"Processing a response: '{response_text}'")

    response = {
        "id": f"chatcmpl-mock-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        # Release flag surfaced in the payload object type so the streaming
        # release gate is observable end-to-end.
        "object_type": "chat.completion.chunk" if streaming_enabled else "chat.completion",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": response_text
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": sum(len(m.get("content", "").split()) for m in messages),
            "completion_tokens": len(response_text.split()),
            "total_tokens": sum(len(m.get("content", "").split()) for m in messages) + len(response_text.split())
        }
    }
    return jsonify(response)


@app.route('/v1/models', methods=['GET'])
def list_models():
    """List available models"""
    return jsonify({
        "object": "list",
        "data": [
            {
                "id": "astronomy-llm",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "astronomy-shop"
            }
        ]
    })


if __name__ == '__main__':

    # Initialize FeatBit (native SDK). Returns gracefully if unconfigured.
    featbit_client.init()

    product_review_summaries = load_product_review_summaries(product_review_summaries_file_path)

    app.logger.info(product_review_summaries)

    print("OpenAI API server starting on http://localhost:8000")
    print("Set your OpenAI base URL to: http://localhost:8000/v1")
    app.run(host='0.0.0.0', port=8000, debug=True)
