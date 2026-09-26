# FRIDAY AI — Video Mode + Plugins setup

## 1. Backend deploy karo
GitHub Pages sirf static files serve karta hai, Python nahi chala sakta.
`app.py` + `plugins.py` ko kahin deploy karo jo Python chalata ho —
Render, Railway, ya Fly.io (sabme free tier hai).

Render pe quick steps:
1. `app.py`, `plugins.py` aur ek `requirements.txt` (neeche) ek naye GitHub
   repo me daalo.
2. Render.com → New → Web Service → wo repo select karo.
3. Build command: `pip install -r requirements.txt`
   Start command: `python app.py`
4. Environment variable add karo: `OPENAI_API_KEY` = apni OpenAI key.
   (Web search plugin chahiye to `SERPAPI_KEY` bhi add kar sakte ho.)
5. Deploy hone ke baad Render ek URL dega, jaise:
   `https://friday-backend.onrender.com`

## 2. Frontend me sirf 1 line badlo
`script.js` ki line 4 me apna backend URL daalo:

```js
const API_BASE = "https://friday-backend.onrender.com";
```

Fir `index.html`, `style.css`, `script.js` teeno GitHub Pages repo me
upload/commit kar do — bas.

## requirements.txt
```
flask
flask-cors
openai
requests
```

## Video Mode kaise use hoga
Chat screen pe **+** button dabao → **🎥 Video Mode (Live)** tap karo.
Camera on hoga, aap bologe, FRIDAY frame dekhega + sunega + bolke jawab
dega. Flip button (🔄) se front/back camera switch hoti hai.

## Naya plugin (koi bhi app se connect) kaise add karo
`plugins.py` kholo — upar comment mein 5 steps likhe hain. Har plugin
bas ek Python function hai jo kisi app ki API call karta hai; FRIDAY
khud decide karta hai kab use karna hai.
