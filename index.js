const express = require('express')
var cors = require('cors')
var bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
const port = process.env.PORT || 3001;
const { MongoClient, ObjectID } = require('mongodb');
const nodemailer = require("nodemailer");
var jwt = require('jsonwebtoken');
const secret = "Mission Australia";
const passwordHash = require('password-hash');
const databaseName = "heroku_z60d043p";
const dbUrl = "mongodb://darpan:Darpan30@ds147207.mlab.com:47207/heroku_z60d043p";

async function sendEmail(toEmail, token, type) {
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        auth: {
            user: "jaydarpan7@gmail.com",
            pass: "Darpan123d"
        }
    });

    var htmlContent = "";
    if (type === "verify") {
        htmlContent = "Verify account using <a href='https://missionaustralia-back.herokuapp.com/verifyEmail?token=" + token + "'>this</a> link";
    } else if (type === "forgot") {
        htmlContent = "Reset password using <a href='https://missionaustralia-back.herokuapp.com/reset/" + token + "'>this</a> link"
    }

    let info = await transporter.sendMail({
        from: '"Mission Australia" <jaydarpan7@gmail.com>', // sender address
        to: toEmail, // list of receivers
        subject: "Email Verification", // Subject line
        html: htmlContent // html body
    });

    console.log("Message sent: %s", info.messageId);

    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}

async function listDatabases(client) {
    databasesList = await client.db().admin().listDatabases();

    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
};

async function getQuestions() {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        const cursor = await client.db(databaseName).collection("Questions")
            .find();

        const results = await cursor.toArray();

        if (results.length > 0) {
            console.log(`Found listing(s)`);
            results.forEach((result, i) => {
                console.log(result, i);
            });
            return results;
        } else {
            console.log(`No questions found`);
        }

    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function getQuestion(qid) {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        var result = await client.db(databaseName).collection("Questions")
            .findOne({ '_id': ObjectID(qid) });

        return result;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function addQuestion(questionObj) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        questionObj.comments = [];
        const result = await client.db(databaseName).collection("Questions").insertOne(questionObj);
        return result.ops;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function postComment(qid, token, comment) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        var decoded = jwt.verify(token, secret);
        console.log(decoded.username);

        var question = await getQuestion(qid);
        console.log(question._id);

        question.comments.push({
            user: decoded.username,
            content: comment
        });

        const result = await client.db(databaseName).collection("Questions")
            .updateOne({ '_id': ObjectID(question._id) }, { $set: question });

        return result;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function registerUser(registerObj) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        var result = await client.db(databaseName).collection("Users")
            .findOne({ email: registerObj.email });

        if (result) {
            console.log(result);
            result = { status: 300, message: "Email already exist. Please Login" }
        } else {
            console.log(`No email found`);
            var hashedPassword = passwordHash.generate(registerObj.password);
            registerObj.password = hashedPassword;
            var inserted = await client.db("missionAustralia").collection("Users").insertOne(registerObj);
            var token = jwt.sign(inserted.ops[0], secret);
            var output = await sendEmail(registerObj.email, token, "verify");
            result = { status: 200, message: "Verification email sent" }
        }

        return result;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function verifyEmail(_id, obj) {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        const result = await client.db(databaseName).collection("Users")
            .updateOne({ '_id': ObjectID(_id) }, { $set: obj });

        return result;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function login(email, password) {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        var result = await client.db(databaseName).collection("Users")
            .findOne({ email: email });

        if (result) {
            console.log(result);
            if (result.verified === true) {
                if (passwordHash.verify(password, result.password)) {
                    delete result.password;
                    var token = jwt.sign(result, secret);
                    result = { status: 200, message: "Login Successful", token, admin: result.admin, title: result.title }
                } else {
                    result = { status: 505, message: "Invalid credentials" }
                }
            } else {
                result = { status: 403, message: "Please verify your account" }
            }
        } else {
            result = { status: 404, message: "User not available. Please register" }
        }
        return result;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function updatePassword(token,password) {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("TOKEN",token,password);
    
    try {
        await client.connect();
        try {
        var decoded = jwt.verify(token, secret);

        var result = await client.db(databaseName).collection("Users")
            .findOne({ email: decoded.email });

        if (result) {
            var _id = decoded._id;
            delete decoded._id;
            delete decoded.iat;
            decoded.password = passwordHash.generate(password);
            const out = await client.db("missionAustralia").collection("Users")
                .updateOne({ '_id': ObjectID(_id) }, { $set: decoded });
            result = { status: 200, message: "Password updated" }
        } else {
            result = { status: 404, message: "User not available. Please register" }
        }
        return result;
    } catch(err) {
        console.log(err);
        result = { status: 500, message: "Token Error" }
    }
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function addOpportunity(opportunityObj) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const result = await client.db(databaseName).collection("Opportunities").insertOne(opportunityObj);
        return result.ops;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function getOpportunities() {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        const cursor = await client.db(databaseName).collection("Opportunities")
            .find();

        const results = await cursor.toArray();

        if (results.length > 0) {
            results.forEach((result, i) => {
                console.log(result, i);
            });
            return results;
        } else {
            console.log(`No opportunity found`);
        }

    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function updateOpportunity(token,body) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    
    try {
        await client.connect();
        try {
        var decoded = jwt.verify(token, secret);
        
        var result = await client.db(databaseName).collection("Opportunities")
            .findOne({ _id: ObjectID(body._id) });
        
        if (result) {
            var _id = body._id;
            delete body._id;
            delete body.iat;
            delete body.token;
            const out = await client.db(databaseName).collection("Opportunities")
                .updateOne({ '_id': ObjectID(_id) }, { $set: body });
            result = { status: 200, message: "Entry updated" }
        } else {
            result = { status: 404, message: "Entry not available" }
        }
        return result;
    } catch(err) {
        console.log(err);
        result = { status: 500, message: "Token Error" }
    }
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function deleteOpportunity(token,oid) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    
    try {
        await client.connect();
        try {
        var decoded = jwt.verify(token, secret);
        
        var result = await client.db(databaseName).collection("Opportunities")
            .remove({ _id: ObjectID(oid) });
        
        if (result) {
            result = { status: 200, message: "Entry removed" }
        } else {
            result = { status: 404, message: "Entry not available" }
        }
        return result;
    } catch(err) {
        console.log(err);
        result = { status: 500, message: "Token Error" }
    }
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function getOrganizations() {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        const cursor = await client.db(databaseName).collection("Organizations")
            .find();

        const results = await cursor.toArray();

        if (results.length > 0) {
            return results;
        } else {
            console.log(`No org found`);
        }

    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function uploadChat(chatObj) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const result = await client.db(databaseName).collection("Chats").insertOne(chatObj);
        return result.ops;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function getChats() {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        const cursor = await client.db(databaseName).collection("Chats")
            .find();

        const results = await cursor.toArray();

        if (results.length > 0) {
            return results;
        } else {
            console.log(`No org found`);
        }

    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function addSurvey(surveyObj) {
    const uri = dbUrl;

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const result = await client.db(databaseName).collection("Surveys").insertOne(surveyObj);
        return result.ops;
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

async function getSurveys() {
    const uri = dbUrl;


    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        const cursor = await client.db(databaseName).collection("Surveys")
            .find();

        const results = await cursor.toArray();

        if (results.length > 0) {
            return results;
        } else {
            console.log(`No survey found`);
        }

    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
}

app.get('/', (req, res) => res.send('Welcome to Mission Australia'))

app.get('/getQuestions', async (req, res) => {
    var output = await getQuestions().catch(console.error);
    res.status(200).send({ response: 200, data: output });
});

app.get('/getQuestion/:qid/:token', async (req, res) => {
    var output = await getQuestion(req.params.qid).catch(console.error);
    res.status(200).send({ response: 200, data: output });
});

app.post('/postComment/:qid', async (req, res) => {
    var output = await postComment(req.params.qid, req.body.token, req.body.comment).catch(console.error);
    res.status(200).send({ response: 200, data: output, msg: 'User registered' });
});

app.post('/addQuestion', async (req, res) => {
    var output = await addQuestion(req.body).catch(console.error);
    res.status(200).send({ response: 200, data: output, msg: 'Question added' });
});

app.post('/registerUser', async (req, res) => {
    var output = await registerUser(req.body).catch(console.error);
    res.status(200).send({ response: 200, data: output, msg: 'User registered' });
});

app.get('/verifyEmail', async (req, res) => {
    var decoded = jwt.verify(req.query.token, secret);
    if (decoded._id) {
        var _id = decoded._id;
        decoded.verified = true;
        delete decoded._id;
        delete decoded.iat;
        var output = await verifyEmail(_id, decoded).catch(console.error);
        res.redirect('http://localhost:3000/#/login?verified=true');
    } else {
        res.redirect('http://localhost:3000/#/login?verified=false');
    }
});

app.post('/login', async (req, res) => {
    var output = await login(req.body.email, req.body.password).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.post('/forgot', async (req, res) => {
    const uri = "mongodb://localhost:27017/missionAustralia";
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();

        var result = await client.db("missionAustralia").collection("Users")
        .findOne({ email: req.body.email });

        if (result) {
            var token = jwt.sign(result, secret);
            var output = await sendEmail(req.body.email, token, "forgot");
            res.status(200).json({ response: 200, data: "Email Sent" }).send();
        } else {
            res.status(200).json({ response: 500, data: "Email not registered" }).send();
        }
    } catch (e) {
        console.error(e);
        return null;
    } finally {
        await client.close();
    }
});

app.get('/reset/:token', async (req, res) => {
    console.log("TOKEN",req.param('token'));
    
    var decoded = jwt.verify(req.param('token'), secret);
    if (decoded._id) {
        res.redirect('http://localhost:3000/#/reset/'+req.param('token'));
    } else {
        res.redirect('http://localhost:3000/#/reset/false');
    }
});

app.post('/updatePassword', async (req, res) => {
    var output = await updatePassword(req.body.token,req.body.password).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.post('/addOpportunity', async (req, res) => {
    var output = await addOpportunity(req.body).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.get('/getOpportunities', async (req, res) => {
    var output = await getOpportunities().catch(console.error);
    res.status(200).send({ response: 200, data: output });
});

app.post('/updateOpportunity', async (req, res) => {
    var output = await updateOpportunity(req.body.token,req.body).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.post('/deleteOpportunity', async (req, res) => {
    var output = await deleteOpportunity(req.body.token,req.body._id).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.get('/getOrganizations', async (req, res) => {
    var output = await getOrganizations().catch(console.error);
    res.status(200).send({ response: 200, data: output });
});

app.post('/uploadChat', async (req, res) => {
    var output = await uploadChat(req.body).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.get('/getChats', async (req, res) => {
    var output = await getChats().catch(console.error);
    res.status(200).send({ response: 200, data: output });
});

app.post('/addSurvey', async (req, res) => {
    var output = await addSurvey(req.body).catch(console.error);
    res.status(200).json({ response: 200, data: output }).send();
});

app.get('/getSurveys', async (req, res) => {
    var output = await getSurveys().catch(console.error);
    res.status(200).send({ response: 200, data: output });
});

app.listen(port, () => console.log(`Mission Australia listening at https://missionaustralia-back.herokuapp.com  : ${port}`))
