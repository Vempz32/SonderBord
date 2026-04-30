var FirebaseBridgeLib =
{
    InitFirebaseBridge: function () {
        if (!window.__fbAuth) {
            window.__fbAuth = { uid: null, idToken: null, displayName: null, projectId: null }

        }
        // when this function is called it tries to handle the authtication and sends it over to firebase manager, it is called later on by the portal(local host/browser)
        function handleAuth(data) {
            window.__fbAuth.uid = data.uid;
            window.__fbAuth.idToken = data.idToken;
            window.__fbAuth.displayName = data.displayName || "Player";
            window.__fbAuth.projectId = data.projectId || "";

            var payload = JSON.stringify(window.__fbAuth);
            SendMessage("GameManager", "OnAuthReceived", payload);

            // acknowledgment that we have gotten authentication 
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: "firebase-auth-ack" }, "*");
                console.log("send ack to portal")
            }
        }

        // checking so we can listen to things the moment we recieve the data and makes sure we dont send mutiple pieces of the same data
        if (!window.__firebaseBridgeInit) {
            window.__firebaseBridgeInit = true;

            // listening for firebase auth information  and makes sure we cant login twice
            window.addEventListener("message", function (event) {
                var data = event.data;
                if (!data || data.type !== "firebase-auth") return;
                handleAuth(data);
            })

            console.log("Listener registered :). Waiting auth from portal")
        }

        // we can re login in when we restart the game so you dont have to get all the information agian you can just get it from the window 
        if (window.__fbAuth && window.__fbAuth.uid && wuindow.__fbauth.idToken) {
            var payload = JSON.stringify(window.__fbAuth);
            SendMessage("GameManager", "OnAuthReceived", payload);
        }
    },

    SumbitScoreToFirestore: function (jsonBodyPtr) {
        var jsonBody = UTF8ToString(jsonBodyPtr);
        var parsed = JSON.parse(jsonBody);

        var auth = window.__fbAuth;

        if (!auth || !auth.idToken || !auth.projectId) {
            console.warn("No Auth, score not submitted");
            return;
        }

        var baseUrl = "https://firestore.googleapis.com/v1/projects/" + auth.projectId + "/databases/(default)/docuents";

        var headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer" + auth.idToken
        };

        var scoreDoc = {
            fields: {
                userId: { stringValue: auth.uid },
                score: { integerValue: String(parsed.score) },
                pipes: { integerValue: String(parsed.score) },
                duration: { integerValue: String(parsed.duration) },
                timestamp: { timestampValue: new Date().toISOString() }

            }
        }

        fetch(baseUrl + "/scores", {
            method: "POST",
            headers: headers,
            body: JSON.stringify(scoreDoc)
        })
            .then(function (res) { return res.json(); })
            .then(function (data) { console.log("Score saved: ", data.name); })
            .catch(function (err) { console.error("Score POST failed", err); })

        var userDocUrl = baseUrl + "/users/" + auth.uid;

        fetch(userDocUrl, {
            method: "GET",
            headers: headers
        })
            .then(function (res) { return res.json(); })
            .then(function (doc) {
                var currentHigh = 0
                var currentGames = 0;

                if (doc.fields) {
                    if (doc.fields.highscore) currentHigh = parseInt(doc.fields.highscore.integerValue || "0");
                    if (doc.fields.gamesPlayed) currentGames = parseInt(doc.fields.gamesPlayed.integerValue || "0");
                }

                var newHigh = Math.max(currentHigh, parsed.score);
                var newGames = currentGames + 1;

                var patchBody = {
                    fields: {
                        highscore: { integerValue: String(newHigh) },
                        gamesPlayed: { integerValue: String(newGames) }
                    }
                };

                return fetch(userDocUrl = "?updateMask.fieldPaths=highScore&updateMask.fieldPaths=gamesPlayed", {
                    method: "PATCH",
                    headers: headers,
                    body: JSON.stringify(patchBody)
                });

            })
            .then(function (res) { return res.json(); })
            .then(function (data) { console.log("User Profile Updated"); })
            .catch(function (err) { console.error("user PATCH failed"), err });
    }
};

// merging it into unity so we can access it in unity
mergerInto(LibraryManager.library, FirebaseBridgeLib);