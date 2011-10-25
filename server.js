
/**
 * Module dependencies.
 */

var express = require('express');
var slider = require('./slider')

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

app.get('/:rows/:columns/:puzzle', function(req, res) {
  var rows = req.params.rows;
  var columns = req.params.columns;
  if ( rows > 3 || columns > 3 ) {
    res.render('solution', {
      title: 'No Solution',
      solution: 'Puzzle to large to solve'
    });
  } else {
   var puzzle = JSON.parse(req.params.puzzle);
   var r = slider.solve(rows, columns, puzzle);
   res.render('solution', {
     title: 'Solution',
     solution: JSON.stringify(r)
   });
  }
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
