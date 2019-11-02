require('dotenv').config();
const { Firebase } = require('firestore-db');
const session = require('express-session');
const bodyParser = require('body-parser');
const express = require('express');
const app = express();

const db = new Firebase({
	projectId: process.env.PROJECT_ID,
	clientEmail: process.env.CLIENT_EMAIL,
	privateKey: process.env.PRIVATE_KEY
}).firestore();

const checkExisting = user => new Promise(resolve => {
	const queried = db.collection('web_logins')
		.where('username', '==', user)
		.get();

	queried.then(snapshot => {
		snapshot.forEach(doc => {
			const data = Object.assign(doc.data(), { id: doc.id });
			return resolve(data);
		});
		if (!snapshot.size) return resolve(null);
	});
});

const createAccount = (user, pass) => new Promise(resolve => {
	const ref = db.collection('web_logins')
		.add({ username: user, password: pass });

	ref.then(doc => {
		const data = Object.assign({ username: user, password: pass }, { id: doc.id });
		return resolve(data);
	});
});

const verifyLogin = (user, pass) => new Promise(resolve => {
	const queried = db.collection('web_logins')
		.where('username', '==', user)
		.where('password', '==', pass)
		.limit(1)
		.get();

	queried.then(snapshot => {
		snapshot.forEach(doc => {
			const data = Object.assign(doc.data(), { id: doc.id });
			return resolve(data);
		});
		if (!snapshot.size) return resolve(null);
	});
});

const deleteAccount = user => new Promise(resolve => {
	const queried = db.collection('web_logins')
		.where('username', '==', user)
		.limit(1)
		.get();

	queried.then(snapshot => {
		snapshot.forEach(doc => {
			const id = Object.assign({ id: doc.id }, {});
			doc.ref.delete();
			return resolve(id);
		});
		if (!snapshot.size) return resolve(null);
	});
});

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');

app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: true,
	cookie: { expires: 2.16e+7 }
}));

app.get('/', (req, res) => res.render('index.ejs', { user: req.session.user }));

app.get('/dashboard', (req, res) => {
	if (req.session.user) return res.render('dashboard.ejs', { user: req.session.user });
	return res.render('404.ejs', { msg: 'You have to be signed in to do that!' });
});

app.get('/logout', (req, res) => {
	res.clearCookie('connect.sid');
	req.session.destroy();
	return res.redirect('/');
});

app.post('/login', async (req, res) => {
	const user = await verifyLogin(req.body.username, req.body.password);
	if (user) {
		req.session.user = user;
		return res.redirect('/dashboard');
	}
	return res.render('404.ejs', { msg: 'You have to be signed in to do that!' });
});


app.post('/signup', async (req, res) => {
	if (await checkExisting(req.body.username)) {
		return res.render('404.ejs', { msg: 'There\'s already an user with that username!' });
	}

	const user = await createAccount(req.body.username, req.body.password);
	req.session.user = user;
	return res.redirect('/dashboard');
});

app.get('/download', (req, res) => {
	if (req.session.user) {
		res.setHeader('Content-Disposition', 'attachment; filename=userinfo.txt');
		res.setHeader('Content-type', 'application/json');
		res.charset = 'UTF-8';
		res.write(JSON.stringify({
			user: req.session.user.username,
			id: req.session.user.id,
			password: req.session.user.password
		}, null, 1));
		return res.end();
	}
	return res.render('404.ejs', { msg: 'You have to be signed in to do that!' });
});

app.get('/delete', async (req, res) => {
	if (req.session.user) {
		await deleteAccount(req.session.user.username);
		return res.redirect('/');
	}
	return res.render('404.ejs', { msg: 'You have to be signed in to do that!' });
});

app.use((req, res) => res.redirect('/'));

app.listen(process.env.PORT, () => {
	console.log(`Server Listening On Port ${process.env.PORT}`);
});
