const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Usuario = require('./models/Usuario');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let usuario = await Usuario.obtenerPorEmail(profile.emails[0].value);
    if (!usuario) {
      usuario = new Usuario(
        null,
        profile.displayName,
        profile.emails[0].value,
        '', // sin password
        'lector',
        null,
        null,
        'google' // <--- proveedor
      );
      await usuario.guardar();
    }
    return done(null, usuario);
  } catch (err) {
    return done(err, null);
  }
}));

module.exports = passport;
