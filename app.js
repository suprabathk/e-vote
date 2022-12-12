const express = require("express");
const app = express();
const csrf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const { Admin, Election, Questions } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
const LocalStratergy = require("passport-local");

const saltRounds = 10;

app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("Some secret String"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.use(
  session({
    secret: "my-super-secret-key-2837428907583420",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use((request, response, next) => {
  response.locals.messages = request.flash();
  next();
});
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStratergy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid Email-ID" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  Admin.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

//landing page
app.get("/", (request, response) => {
  if (request.user) {
    return response.redirect("/elections");
  } else {
    response.render("index", {
      title: "Online Voting Platform",
    });
  }
});

//elections home page
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    let loggedinuser = request.user.firstName + " " + request.user.lastName;
    try {
      const elections = await Election.getElections(request.user.id);
      response.render("elections", {
        title: "Online Voting Platform",
        userName: loggedinuser,
        elections,
      });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//signup page
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Create admin account",
    csrfToken: request.csrfToken(),
  });
});

//create user account
app.post("/admin", async (request, response) => {
  if (!request.body.firstName) {
    request.flash("error", "Please enter your first name");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Please enter email ID");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Please enter your password");
    return response.redirect("/signup");
  }
  if (request.body.password < 8) {
    request.flash("error", "Password length should be atleast 8");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  try {
    const user = await Admin.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/elections");
      }
    });
  } catch (error) {
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});

//login page
app.get("/login", (request, response) => {
  if (request.user) {
    return response.redirect("/elections");
  }
  response.render("login", {
    title: "Login to your account",
    csrfToken: request.csrfToken(),
  });
});

//login user
app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/elections");
  }
);

//signout
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

//password reset page
app.get(
  "/password-reset",
  connectEnsureLogin.ensureLoggedIn(),
  (request, response) => {
    response.render("password-reset", {
      title: "Reset your password",
      csrfToken: request.csrfToken(),
    });
  }
);

//reset user password
app.post(
  "/password-reset",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (!request.body.old_password) {
      request.flash("error", "Please enter your old password");
      return response.redirect("/password-reset");
    }
    if (!request.body.new_password) {
      request.flash("error", "Please enter a new password");
      return response.redirect("/password-reset");
    }
    if (request.body.new_password.length < 8) {
      request.flash("error", "Password length should be atleast 8");
      return response.redirect("/password-reset");
    }
    const hashedNewPwd = await bcrypt.hash(
      request.body.new_password,
      saltRounds
    );
    const result = await bcrypt.compare(
      request.body.old_password,
      request.user.password
    );
    if (result) {
      Admin.findOne({ where: { email: request.user.email } }).then((user) => {
        user.resetPass(hashedNewPwd);
      });
      request.flash("success", "Password changed successfully");
      return response.redirect("/elections");
    } else {
      request.flash("error", "Old password does not match");
      return response.redirect("/password-reset");
    }
  }
);

//new election page
app.get(
  "/elections/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    response.render("new_election", {
      title: "Create an election",
      csrfToken: request.csrfToken(),
    });
  }
);

//creating new election
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.body.electionName.length < 5) {
      request.flash("error", "Election name length should be atleast 5");
      return response.redirect("/elections/create");
    }
    try {
      await Election.addElection({
        electionName: request.body.electionName,
        adminID: request.user.id,
      });
      response.redirect("/elections");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//election page
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const election = await Election.getElection(
        request.params.id,
        request.user.id
      );
      const numberOfQuestions = await Questions.getNumberOfQuestions(
        request.params.id
      );
      response.render("election_page", {
        id: request.params.id,
        title: election.electionName,
        nq: numberOfQuestions,
        nv: 23,
      });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//manage questions page
app.get(
  "/elections/:id/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const election = await Election.getElection(
      request.params.id,
      request.user.id
    );
    const questions = await Questions.getQuestions(request.params.id);
    response.render("questions", {
      title: election.electionName,
      id: request.params.id,
      questions: questions,
    });
  }
);

//add question page
app.get(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    response.render("new_question", {
      id: request.params.id,
      csrfToken: request.csrfToken(),
    });
  }
);

//add question
app.post(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.body.question.length < 5) {
      request.flash("error", "question length should be atleast 5");
      return response.redirect(
        `/elections/${request.params.id}/questions/create`
      );
    }
    try {
      const question = await Questions.addQuestion({
        question: request.body.question,
        description: request.body.description,
        electionID: request.params.id,
      });
      return response.redirect(
        `/elections/${request.params.id}/questions/${question.id}`
      );
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

module.exports = app;
