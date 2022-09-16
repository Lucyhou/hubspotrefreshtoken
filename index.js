require('dotenv').config();
const express = require('express')
const querystring = require('querystring')
const axios = require('axios')
const session = require('express-session')
//
const NodeCache=require('node-cache');

const app = express();

//
const accessTokenCache=new NodeCache();



app.set("view engine", "pug");
//li #{contact.properties.firstname.value}  #{contact.properties.lastname.value}
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

//This is arequired parameter in the OAuth flow to verify the authenticity of the app and it needs
 //to match the one we entered in the developer account.
const REDIRECT_URI = `http://localhost:3000/oauth-callback`;

//authorization URL. This URL contains the client ID, the scopes, and that redirect URL.
const authUrl= `https://app.hubspot.com/oauth/authorize?client_id=380253fd-a81b-4790-a8a2-f2df9ec08c00&redirect_uri=http://localhost:3000/oauth-callback&scope=crm.objects.contacts.read`;

//finally, we'll create a variable to store access tokens we get at the end of the OAuth process.
// Usually this would be handled by a database, but we're just using an object here to keep this
 //demo simple. Also we'll set up a session to use as the unique key in that object to match users
 // with their tokens.
//const tokenStore={};
//
const refreshTokenStore={};

app.use(session({
  secret: Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized:true
}));

const isAuthorized =(userId) => {
 // return tokenStore[userId] ? true : false;
 //
 return refreshTokenStore[userId] ? true : false;
};

 const getToken=async(userId) => {
  if (accessTokenCache.get(userId)) {
      console.log(accessTokenCache.get(userId));
      return accessTokenCache.get(userId);
  } else {
    try {
      const refreshTokenProof = {
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        refresh_token: refreshTokenStore[userId]
      };  
      const responseBody = await axios.post('https://api.hubapi.com/oauth/v1/token', querystring.stringify(refreshTokenProof));
      refreshTokenStore[userId] = responseBody.data.refresh__token;
      accessTokenCache.set(userId, responseBody.data.access_token, Math.round(responseBody.data.expires_in *0.75));
      console.log('getting refresh token');  
      return responseBody.data.access_token;
    } catch (e) {
    console.error(e);
    }
  }
}

//1.Send user to authorization page. This kicks off initial request to OAuth server
app.get('/', async (req, res) => {
  if (isAuthorized(req.sessionID)){
   // Inside this route we'll add a conditional that will serve the appropriate content to the home
   // template depending on whether the user is authorized. We'll build the function that checks 
   //this in just a moment, but here's how we'll be using it. 
   //For now we'll leave the true condition empty since we haven't written any of the code to get
    //authorized yet, but we can go ahead and 
    //add this line to the else condition. So here we're rendering the home
    //template and passing it the authorization URL that we built a few moments ago.
    const accessToken =await getToken(req.sessionID);
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };
    const contacts= `http://api.hubapi.com/crm/v3/objects/contacts`;
    
    try {
        const resp = await axios.get(contacts, {headers});
        const data = resp.data;
        res.render('home', { 
            token: accessToken,
            contacts: data.results 
      });     
  } catch (error) {
      console.error(error);
  }

  }else{
    res.render('home',{ authUrl });
  }    
});

//2.Get temporary authorization code from OAuth server
//3.Combine temporary auth code with app credentials and send back to OAuth server

app.get('/oauth-callback', async (req, res) => {
  //res.send(req.query.code);
  
  //--We've plugged in all of the app credentials from the top of this file and the temporary auth code
  const authCodeProof = {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code: req.query.code
  };
  try {
    //we'll use axios to send this over to the endpoint
    // we're using querystring here to convert that object into the urlencoded format
    const responseBody = await axios.post('https://api.hubapi.com/oauth/v1/token', querystring.stringify(authCodeProof));
    //s try printing the result of this call out to see what we get [res.json(responseBody.data)
    //res.json(responseBody.data);
    
    //4.Get access and refresh tokens
    //
    refreshTokenStore[req.sessionID] = responseBody.data.refresh_token;
    accessTokenCache.set(req.sessionID, responseBody.data.access_token,5);
        //tokenStore[req.sessionID] = responseBody.data.access_token;
    res.redirect('/');
  } catch (error) {
    console.error(error);
  }
});




//4.Get access and refresh tokens

app.listen(3000, () => console.log('App running here: http://localhost:3000'));