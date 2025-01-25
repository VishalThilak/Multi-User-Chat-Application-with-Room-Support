import openai
import sys
import json
# Set your API key
secret_key = "#"
from openai import OpenAI
client = OpenAI(api_key=secret_key)
# import SentimentIntensityAnalyzer class
# from vaderSentiment.vaderSentiment module.
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
# function to print sentiments
# of the sentence.
def sentiment_scores(sentence):
    # Create a SentimentIntensityAnalyzer object.
    sid_obj = SentimentIntensityAnalyzer()
    # polarity_scores method of SentimentIntensityAnalyzer
    # object gives a sentiment dictionary.
    # which contains pos, neg, neu, and compound scores.
    sentiment_dict = sid_obj.polarity_scores(sentence)
    # decide sentiment as positive, negative and neutral
    if sentiment_dict['compound'] >= 0.05 :
        return "positive"
    elif sentiment_dict['compound'] <= - 0.05 :
        return "negative"
    else :
        return "neutral"
        
def suggest_reply_with_sentiment(input_message, user_intent=None):
    # First get VADER sentiment
    vader_sentiment = sentiment_scores(input_message)
    messages = [
        {"role": "system", "content": "As if you are a friend of a messager, reply to the message input. Be casual, clear and make messages like a friend would give. Exclude any greetings or salutations."},
        {"role": "system", "content": f"Initial VADER sentiment analysis shows this message is {vader_sentiment}. Please do your own sentiment analysis and provide a response that acknowledges the emotional tone. Start your response with (strictly follow this format) SENTIMENT:positive/negative/neutral followed by ||, then your reply."},
        {"role": "user", "content": input_message}
    ]
    if user_intent:
        messages.append({"role": "system", "content": f"The user wants to send a reply that aligns with the following intent: {user_intent}."})
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=messages,
        max_tokens=50,
        temperature=0.5
    )
    # Get ChatGPT's response and parse it
    full_response = response.choices[0].message.content.strip()
    gpt_sentiment, reply = full_response.split("||", 1)
    gpt_sentiment = gpt_sentiment.replace("SENTIMENT:", "").strip().lower()
    return {
        "analysis": gpt_sentiment,
        "suggestion": reply.strip()
    }
input= sys.argv[1]
data_to_pass_back = suggest_reply_with_sentiment(input, "")
output = json.dumps(data_to_pass_back)
# print(output)
sys.stdout.write(output)
sys.stdout.flush()
# def chat_with_gpt():
#     print("Your buddy: Hello! How can I assist you today? (Type 'exit' to quit)")
    
#     # Maintain the conversation history
#     conversation = [{"role": "system", "content": "You are a helpful assistant."}]
    
#     while True:
#         # Get user input
#         user_input = input("You: ")
        
#         # Exit condition
#         if user_input.lower() in ["exit", "quit", "bye"]:
#             print("ChatGPT: Goodbye! Have a great day!")
#             break
        
#         # Add the user input to the conversation
#         conversation.append({"role": "user", "content": user_input})
        
#         try:
#             # Get GPT response
#             response = openai.chat.completions.create(
#                 model="gpt-3.5-turbo",  # Use a valid model like "gpt-4" or "gpt-3.5-turbo"
#                 messages=conversation
#             )
            
#             # Extract the message content correctly
#             gpt_message = response.choices[0].message.content
            
#             # Print GPT response
#             print(f"ChatGPT: {gpt_message}")
            
#             # Add GPT response to the conversation history
#             conversation.append({"role": "assistant", "content": gpt_message})
        
#         except Exception as e:
#             print(f"Error: {e}")
# # Run the chat function
# if __name__ == "__main__":
#     chat_with_gpt()
