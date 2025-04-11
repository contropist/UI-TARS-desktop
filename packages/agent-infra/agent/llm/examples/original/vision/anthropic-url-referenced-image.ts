import Anthropic from '@anthropic-ai/sdk';

/**
 * An example for recognizing text in an image.
 *
 * @see https://github.com/anthropics/anthropic-sdk-typescript#usage
 * @see https://docs.anthropic.com/en/docs/build-with-claude/vision
 * @see https://docs.anthropic.com/en/api/messages-examples?q=Option+1%3A+Base64-encoded+image#vision
 */
async function main() {
  const client = new Anthropic({
    apiKey: process.env['ANTHROPIC_API_KEY'], // This is the default and can be omitted
  });
  const response = await client.messages.create({
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract key information from this image at markdown',
          },
          {
            type: 'image',
            source: {
              url: 'https://sf16-sg.tiktokcdn.com/obj/eden-sg/psvhouloj/images/simple-image.png',
              type: 'url',
            },
          },
        ],
      },
    ],
    model: 'claude-3-5-sonnet-latest',
    stream: true,
  });

  for await (const chunk of response) {
    console.log(JSON.stringify(chunk));
  }
}

main();
