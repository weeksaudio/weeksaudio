const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { trackId, trackName, price, audioUrl, contractUrl } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: trackName,
            description: 'WEEKS® Audio Design',
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&track_id=${trackId}`,
      cancel_url: `${process.env.SITE_URL}/index.html`,
      metadata: {
        track_id: trackId,
        audio_url: audioUrl,
        track_name: trackName,
        // Stripe metadata values must be strings; empty string when no contract exists.
        contract_url: contractUrl || '',
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
