const Recaptcha = require('express-recaptcha').RecaptchaV3;

const recaptcha = new Recaptcha(process.env.RECAPTCHA_SITE_KEY, process.env.RECAPTCHA_SECRET, {
  action: 'homepage',
  callback: 'cb',
});

module.exports = (req, res) => {
  recaptcha.verify(req, (error, data) => {
    res.json({
      ts: Date.now(),
      score: data.score,
      error,
    });
  });
};
