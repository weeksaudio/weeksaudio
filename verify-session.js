const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const sessionId = event.queryStringParameters.session_id;

  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No session id' }) };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          audioUrl: session.metadata.audio_url,
          trackName: session.metadata.track_name,
          contractUrl: session.metadata.contract_url || null,
        }),
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: 'Payment not completed' }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
