var debug = true;
function l(x, or) { 
    if (debug || or) {
        console.log(x); 
    }
}
var GA = (function($, canvas, status, controls){
    var self = {};
    self.ctx = null;
    
    // Maze obj constructor
    var Maze = function(start_x, start_y, end_x, end_y, rects, width, height) {
        //this.img_src = img_src;
        //this.img;
        this.rects = rects;
        this.start_x = start_x;
        this.start_y = start_y;
        this.end_x = end_x;
        this.end_y = end_y;
        this.width = width;
        this.height = height;
    };
    Maze.prototype.draw = function(ctx) {
        ctx.fillStyle = "rgb(255,0,0)";
        ctx.fillRect(this.start_x - 5, this.start_y - 5,10,10);
        
        ctx.fillStyle = "rgb(0,0,255)";
        ctx.fillRect(this.end_x - 5, this.end_y - 5,10,10);
        
        ctx.fillStyle = "rgb(0,0,0)";
        for (var i =0 ; i < this.rects.length; i++) {
            var r = this.rects[i];
            ctx.fillRect(r[0],r[1],r[2],r[3]);
        }
        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.strokeRect(0,0,this.width, this.height);
    };
    // How many times does the path collide with each obstacle?
    Maze.prototype.findCollisions3 = function(points) {
        var ret = 0;
        for (var j = 0; j < this.rects.length; j++) {
            var r = this.rects[j];
            var el = r[0],
                et = r[1],
                er = r[0] + r[2],
                eb = r[1] + r[3];
            
            var hasCollided = false;
            console.log('new obst:' + el + ' ' + et);
            for (var cur = 0, next = 1; next < points.length; cur++, next++) {
                var curPoint = points[cur];
                var nextPoint = points[next];
                
                var collided = this.lineIntersectsRect(curPoint, nextPoint, el, er, et, eb)
                if (collided) {
                    // if we havent yet uncollided this obsctacle,
                    // i.e., the path went in and out of this obstable
                    //if (!hasCollided) {
                        ret++;
                        console.log('collision!');
                    //}
                    hasCollided = true;
                } else {
                    hasCollided = false;
                }
            }
            
        }
        console.log('RET IS:' + ret);
        return ret;
    }
    Maze.prototype.findCollisions = function(points) {
        var ret = 0;
        for (var cur = 0, next = 1; next < points.length; cur++, next++) {
            var curPoint = points[cur];
            var nextPoint = points[next];
            var did = false;
            for (var j = 0; j < this.rects.length; j++) {
                var p1 = points[cur];
                var p2 = points[next];
                var r = this.rects[j];
                var el = r[0],
                    et = r[1],
                    er = r[0] + r[2],
                    eb = r[1] + r[3];
                    
                // Total up teh percent of intersection
                var percent = this.lineIntersectsRect(p1, p2, el, er, et, eb);
                
                // Length between p1 and p2
                var d = Math.sqrt(  Math.pow((p2[0] - p1[0]),2) + 
                                    Math.pow((p2[1] - p1[1]),2));
                
                ret += (percent * d)
            }
        }
        return ret;
    };
    // Liang-Barsky clipping
    // modified from: http://www.skytopia.com/project/articles/compsci/clipping.html
    Maze.prototype.lineIntersectsRect = function(p1,p2, el, er, eb, et) {
        var dx = p2[0] - p1[0],
            dy = p2[1] - p1[1],
            t0 = 0.0, t1 = 1.0,
            p,q,r;
                
        for (var edge = 0; edge < 4; edge++) {
            if (edge==0) {  p = -dx;  q = -(el - p1[0]); }
            if (edge==1) {  p = dx;   q =  (er - p1[0]); }
            if (edge==2) {  p = -dy;  q = -(eb - p1[1]); }
            if (edge==3) {  p = dy;   q =  (et - p1[1]); }   
            r = q/p;
            if (p==0 && q<0) {
                return 0;   // Don't draw line at all. (parallel line outside)
            }

            if (p<0) {
                if (r>t1) {
                    return 0;         // Don't draw line at all.
                } else if (r>t0) {
                    t0=r;            // Line is clipped!
                }
            } else if (p>0) {
                if (r<t0) {
                    return 0;      // Don't draw line at all.
                } else if (r<t1) {
                    t1=r;         // Line is clipped!
                }
            }
        }
        
        /*
        var x0clip = x0src + t0*xdelta;
        var y0clip = y0src + t0*ydelta;
        var x1clip = x0src + t1*xdelta;
        var y1clip = y0src + t1*ydelta;
        */
        // Return the percentage of this line that intersects,
        // t1-10
        return Math.abs(t1-t0);
    }
    
    self.updateProbs = function() {
        // decrease chance of random mttn, increase chance of small/flip
        if (self.mutateProbs.RANDOM + self.mutateProbs.FLIP +
            self.mutateProbs.SMALL < 1.0) {
            
            self.mutateProbs.RANDOM     *= 0.9995;
            self.mutateProbs.FLIP       *= 1.0005;
            self.mutateProbs.SMALL      *= 1.0005;
        }
    }
    self.mutateProbs = {
        SMALL : 0.05, 
        FLIP : 0.025, 
        RANDOM : 0.025
    }
    
    // Individual Path stuff
    var Path = function(angles) {

        this.path_angles = angles || this.generateAngles();
        this.points = [];
        this.col = '#' + Math.round(0xffffff * Math.random()).toString(16);
        this.start = [self.maze.start_x, self.maze.start_y];
        this.end = [self.maze.end_x, self.maze.end_y];

        this.mutateFns = {
            SMALL : this.smallMutation, 
            FLIP : this.flipMutation, 
            RANDOM :this.randomMutation
        };
        
        this.calcFitness();
    };
        
    // Find p3 given p1 and p2 and angle p1p3p2
    Path.prototype.findPointBetweenGivenAngle = function(p1, p2, angle) {
        var startEndAngle = rad2deg(Math.atan2(p2[0] - p1[0], p1[1] - p2[1]));

        // Length of line between p1 and p2, "baseline"
        var baseLength = Math.sqrt( Math.pow((p2[0] - p1[0]),2) + 
            Math.pow((p2[1] - p1[1]),2));

        // Angle relative from the baseline
        var relativeInsideAngle = (180 - angle)/2;

        // Length of p1 to p3
        var sideLength = Math.sin(deg2rad(relativeInsideAngle)) * 
            (baseLength/Math.sin(deg2rad(angle)));

        // Angle from North
        var angleFromNorth = startEndAngle - relativeInsideAngle;

        // Calculate p3
        var p3 = getPointAt(p1, sideLength, angleFromNorth);

        return p3;
    };
    
    // Recursively generate angles
    Path.prototype.generateAngles = function() {
        var nAngles = 20 + Math.floor(Math.random()*30);
        var start_end_points = [[self.maze.start_x, self.maze.start_y], [self.maze.end_x, self.maze.end_y]];
        
        // Occaisionally, the root left or right could be null, which really 
        // messes up the path, so ensure we actually have path which has both 
        // left and right children
        var ret = null;
        var x = 0;
        while (!ret || (!ret.leftChild || !ret.rightChild)) {
            if (x > 0) {
                x = 0;
            }
            ret = this.generateAnglesHelper(start_end_points, nAngles);
            
            if (!ret.leftChild) {
                x++;
            }
            if (!ret.rightChild) {
                x++;
            }
        }
        return ret;
    };
    Path.prototype.generateAnglesHelper = function(points, nAngles) {
        var p1 = points[0];
        var p2 = points[1];
        
        var a_p3 = this.angleBetweenPoints(points);
        var angle = a_p3[0];
        var p3 = a_p3[1];
        
        // If no more angles needed, stop
        var tree = new BinaryTree(angle);
        
        // Split nAngles
        var anglesLeft = nAngles - 1; // as we just made one...
        var nLeftAngles = Math.round(Math.random() * anglesLeft);
        var nRightAngles = anglesLeft - nLeftAngles;
        if (nLeftAngles > 0) {
            tree.leftChild = this.generateAnglesHelper([p1,p3], nLeftAngles);
        }
        if (nRightAngles > 0) {
            tree.rightChild = this.generateAnglesHelper([p3,p2], nRightAngles);
        }
        return tree;
    };
    
    // Return a valid angle between points
    Path.prototype.angleBetweenPoints = function(points) {
        var p1 = points[0];
        var p2 = points[1];
        var p3, angle;
        
        // Find valid angle
        while (true) {
            angle = Math.floor(Math.random()*360);
            p3 = this.findPointBetweenGivenAngle(p1, p2, angle);
            
            // accept this angle?
            if (this.isValidPoint(p3)) {
                break;
            }
        }
        return [angle, p3];
    };
    
    // Is the arg a valid point
    Path.prototype.isValidPoint = function(p) {
        return (p[0] > 0 && p[0] < self.maze.width && p[1] > 0 && p[1] < self.maze.height);
    };
    Path.prototype.allPointsValid = function() {
        var ret = true;
        for (var i = 0; i < this.points.length; i++) {
            if (!this.isValidPoint(this.points[i])) {
                ret = false;
            }
        }
        return ret;
    };
    
    Path.prototype.calcPointsFromAngles = function() {
        var start_end_points = [[self.maze.start_x, self.maze.start_y], [self.maze.end_x, self.maze.end_y]];
        
        // Calculate teh angles, based on the root node
        var addedstuff = this.calcPointsFromAnglesHelper(this.path_angles, start_end_points);
        
        // Prefix start, suffix end
        var points = [start_end_points[0]];
        points = points.concat(addedstuff);
        points.push(start_end_points[1]);
        
        // Done
        this.points = points;
    };
    Path.prototype.calcPointsFromAnglesHelper = function(node, points) {
        var angle = node.data;
        
        var p1 = points[0];
        var p2 = points[1];
        var p3 = this.findPointBetweenGivenAngle(p1, p2, angle);
        
        // Recurse
        var left = node.leftChild ? this.calcPointsFromAnglesHelper(node.leftChild, [p1,p3]) : [];
        var right = node.rightChild ? this.calcPointsFromAnglesHelper(node.rightChild, [p3,p2]) : [];
        
        var added = [];
        added = added.concat(left);
        if (p3) {
            added.push(p3);
        }
        added = added.concat(right);
        return added;
    };
    
    Path.prototype.calcFitness = function() {
        var a1 = 1;
        var a2 = 10;
        if (!this.points.length) {
            this.calcPointsFromAngles();
        }
        var distance = 0;
        for (var cur = 0, next = 1; next < this.points.length; cur++, next++) {
            var curPoint = this.points[cur];
            var nextPoint = this.points[next];
            
            // distance
            distance += Math.sqrt( Math.pow((nextPoint[0] - curPoint[0]),2) + Math.pow((nextPoint[1] - curPoint[1]),2));
            
            if (! this.isValidPoint( nextPoint )) {
                distance += 1000000;
            }
        }
        
        var collisions = self.maze.findCollisions(this.points);
        
        this.fitness = -(a1*distance + a2*collisions); // inverse to enable GT comparisons
    };
    
    Path.prototype.draw = function(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = this.col;
        ctx.moveTo(this.points[0][0], this.points[0][1]);
        
        for (var i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i][0], this.points[i][1]);
        }
        ctx.stroke();
    };

    Path.prototype.crossoverWith = function(other) {
        // Main part: crossover the two angles
        var newAngles = this.path_angles.crossoverWith(other.path_angles);
        
        // Make the resulting path
        var ret = new Path(newAngles);
        return ret;
    };
    Path.prototype.mutate = function() {
        var p = Math.random();
        if (p <= self.mutateProbs.SMALL) {
            return this.mutateFns.SMALL.call(this); 
        }
        if (p <= (self.mutateProbs.FLIP + self.mutateProbs.SMALL)) { 
            return this.mutateFns.FLIP.call(this); 
        }
        if (p <= (self.mutateProbs.RANDOM + self.mutateProbs.FLIP + self.mutateProbs.SMALL)) { 
            return this.mutateFns.RANDOM.call(this); 
        }
        
        return this;
    };
    
    Path.prototype.smallMutation = function () {
        var p = 1/ this.path_angles.size();
        var newAngles = this.path_angles.clone();
        var ret = null;
        var first = true;
        newAngles.preorderTraverse(function(node) {
            var prob = Math.random();
            if (prob < p) {
                // change between -15 and +15
                while (true) {
                    var change = -15 + Math.floor(Math.random()*30);
                    // disallow changing the angle to 0
                    if ((node.data + change) % 360 != 0) {
                        break;
                    }
                }
                node.data += change;
                node.data %= 360; // clamp
                ret = new Path(newAngles);
            }
        });
        ret = ret || new Path(newAngles); // if there weren't any mutations
        return ret;
    };
    Path.prototype.randomMutation = function() {
        var p = 1/ this.path_angles.size();
        var newAngles = this.path_angles.clone();
        var ret = null;
        
        newAngles.preorderTraverse(function(node) {
            var prob = Math.random();
            if (prob < p) {
                while (true) {
                    var change = Math.floor(Math.random()*360);
                    // disallow changing the angle to 0
                    if (change != 0) {
                        break;
                    }
                }
                node.data = change;
                
                ret = new Path(newAngles);
            }
        });
        
        ret = ret || new Path(newAngles);
        return ret;
    };
    
    Path.prototype.flipMutation = function() {
        var p = 1/ this.path_angles.size();
        var newAngles = this.path_angles.clone();
        var ret = null;
        
        newAngles.preorderTraverse(function(node) {
            if (Math.random() < p) {
                node.data *= -1;
                ret = new Path(newAngles);
            }
        });
        
        ret = ret || new Path(newAngles);
        return ret;
    };

    // Available mazes
    var m1 = [[173,0,45,32],[0,66,218,32],[474,0,43,161],[173,82,45,79],[196,98,107,33],[389,98,116,33],[0,195,389,32],[474,195,43,64],[496,195,151,32],[0,292,130,32],[217,292,386,32],[344,317,45,171],[173,357,44,131],[344,317,45,171],[376,389,199,33],[560,357,43,96]];
    
    var m21 = [[0,0,525,61] ,[0,61,34,371] ,[493,61,32,371] ,[0,432,525,61] ,[194,61,17,28] ,[69,133,53,27] ,[265,117,69,30] ,[300,147,34,70] ,[334,175,54,42] ,[265,190,35,27] ,[354,217,33,15] ,[354,232,70,15] ,[334,247,54,14] ,[159,247,70,27] ,[194,274,35,100] ,[300,347,34,42] ,[334,362,36,70]];
    var m2 = [[0,0,525,61] ,[0,61,34,371] ,[493,61,32,371] ,[0,432,525,61] ,[194,61,17,28] ,[69,133,53,27] ,[265,117,69,30] ,[300,147,34,70] ,[334,175,54,42] ,[265,190,35,27] ,[354,217,33,15] ,[354,232,70,15] ,[334,247,54,14] ,[50,247,170,27] ,[194,274,35,160] ,[300,347,34,42] ,[334,362,36,70]];
    var m3 = [[127,79,357,47], [127,126,47,168], [437,126,47,168]];
    //var m1 = [ [400,100, 100, 100] ];
    var mazes = [
                    new Maze(89,389, 436,103, m21, 525, 493)
                    //new Maze(89,389, 436,103, m2, 525, 493)
                  //  new Maze(20,473, 635,16, m1, 647, 488)
                    //new Maze(299,30, 304,180, m3, 647, 488)
                ];
    
    // Preloading awesomeness
    var preload = {
        // http://blog.152.org/2008/01/javascript-image-preloader.html
        count: 0,
        loaded: 0,
        onComplete: function () {},
        loaded_image: "",
        done_mazes: [],
        incoming: [],
        queue: function (mazes) {
            this.loaded = 0;
            this.done_mazes = [];
            this.count = mazes.length;
            this.incoming = mazes;
            this.process_queue();
        },
        process_queue: function () {
            this.load(this.incoming.shift());
        },
        load: function (maze) {
            var this_ref = this;
            maze.img = new Image();
            
            maze.img.onload = function () {
                this_ref.done_mazes.push(maze);
                this_ref.loaded += 1;
                if (this_ref.count == this_ref.loaded) {
                    (this_ref.onComplete)();
                } else {
                    this_ref.process_queue();
                }
            };
            maze.img.src = maze.img_src;
        }
    };
    
    // GA stuff
    self.population = [];
    self.startPopSize = 40;
    self.reset = function() {
        self.population = [];
        self.generation = 0;
        self.ctx.clearRect(0, 0, 1024, 1024);
    };
    self.toggleDrawFittest = function() {
        self.drawFittest = !self.drawFittest;
    }
    self.start = function (which_maze, popSize) {
        // Initialise the maze and population, and draw for the first time
        popSize = popSize || self.startPopSize; 
        var m = mazes[which_maze];
        self.maze = m;
        
        for (var i = 0; i < popSize; i++) {
            self.population.push( new Path() );
        }
        // Draw maze
        m.draw(self.ctx);
        for (i = 0; i< self.population.length; i++) {
            self.population[i].draw(self.ctx);
        }
    };
    self.fittest = null;
    self.generationLimit = 0;
    self.paused = false;
    self.run = function() {
        if (self.generation >= self.generationLimit || self.paused) {
            return;
        }
        self.generation++;
        self.updateProbs();
        
        // Selection
        var newPaths = [];
        
        for (var i = 0; i< 15; i++) {
            var p1cand = [Math.floor(Math.random() * self.population.length), Math.floor(Math.random() * self.population.length)];
            var p2cand = [Math.floor(Math.random() * self.population.length), Math.floor(Math.random() * self.population.length)];
            
            var par1 = (self.population[p1cand[0]].fitness > self.population[p1cand[1]].fitness) ? self.population[p1cand[0]] : self.population[p1cand[1]];
            var par2 = (self.population[p2cand[0]].fitness > self.population[p2cand[1]].fitness) ? self.population[p2cand[0]] : self.population[p2cand[1]];
            
            var crossoverResult = par1.crossoverWith(par2);
            var child = crossoverResult.mutate();
            newPaths.push(child);
        }
        
        // Find (unique) indices of unfit paths to replace
        var indicesToReplace = [];
        for (i = 0; i< newPaths.length; i++) {
            while (true) {
                var a = Math.floor( Math.random() * self.population.length );
                var b = Math.floor( Math.random() * self.population.length );
                var toReplace = self.population[a] > self.population[b] ? b : a;
                
                if ( $.inArray(toReplace, indicesToReplace) == -1) {
                    indicesToReplace.push(toReplace);
                    break;
                }
            }
        }
        
        // Reinsert back into population
        for (i = 0; i< indicesToReplace.length; i++) {
            self.population[indicesToReplace[i]] = newPaths[i];
        }
        
        // Drawing
        self.ctx.clearRect(0, 0, 1024, 1024);
        self.maze.draw(self.ctx);
                
        // Draw pop
        var min = null;
        for (i = 0; i< self.population.length; i++) {
            if (!min || self.population[i].fitness > min.fitness) {
                min = self.population[i];
            }
        }
        self.fittest = min;
        if (self.drawFittest) {
            min.draw(self.ctx);
        } else {
            for (i = 0; i< self.population.length; i++) {
                self.population[i].draw(self.ctx);
            }
        }
        
        // Update UI
        self.updateStatus();
        
        // Stats
        self.logStats()
        
        // Again
        setTimeout(function() {self.run();}, 0);
    };
    
    self.updateStatus = function() {
        var str = "Generation: " + self.generation + "</br>";
        for (var i = 0; i < self.population.length; i++) {
            str += i + " Fitness:" + self.population[i].fitness + self.population[i].path_angles.size() + '::' + self.population[i].path_angles.pprint() + '</br>';
        }
        $(status).html(str);
    };
    
    self.stats = {
        FITNESS_OVER_TIME : [],
        FITTEST_FITNESS : [],
    };
    self.logStats = function() {
        var avg = 0;
        for (var i =0; i < self.population.length; i++ ) {
            avg += self.population[i].fitness;
        }
        avg /= self.population.length;
        
        var entry = [self.generation, avg];
        
        self.stats.FITNESS_OVER_TIME.push(entry);
        
        if (isNaN(self.fittest.fitness)) {
            console.log(self.fittest);
            console.log(self.population);
        }
        
        self.stats.FITTEST_FITNESS.push([self.generation, self.fittest.fitness]);
    }
    
    self.showStats = function() {
        $('#stats').html(self.stats.FITNESS_OVER_TIME);
    }
    
    self.init = function(which_maze) {
        var this_ref = this;
        
        // find the canvas
        self.ctx = canvas.getContext('2d');
        self.ctx.strokeStyle = '#f00';
    
        // default to first maze
        which_maze = which_maze || 0;
    
        // Setup controls
        self.paused = false;
        var b = $('<button type="button"></button>').appendTo(controls)
            .text('Start');
        var g = $('<input type="text"/>').appendTo(controls)
            .val('500');
        b.click(function(){
            self.generation = self.generation || 0;
            self.generationLimit = self.generationLimit + parseInt(g.val(),10);
            self.run(self.generation);
        });
        var pause = $('<button type="button"></button>').appendTo(controls)
            .text('toggle pause')
            .click(function(){
                self.paused = !self.paused;
                if (!self.paused) {
                    self.run();
                }
            });
        $('<br/>').appendTo(controls);
        var p = $('<input type="text"/>').appendTo(controls)
            .val(self.startPopSize);
        var s = $('<button type="button"></button>').appendTo(controls)
            .text('Regen+Reset')
            .click(function(){
                self.reset();
                self.generationLimit = parseInt(g.val(),10);
                self.start(0,p.val());
            });
        var toggle = $('<button type="button"></button>').appendTo(controls)
            .text('Toggle: Draw all paths')
            .toggle(function(){
                self.toggleDrawFittest();
                toggle.text('Toggle: Draw only fittest');
            }, function(){
                self.toggleDrawFittest();
                toggle.text('Toggle: Draw all paths');
            });
        $('<br/>').appendTo(controls);
        var stats = $('<button type="button"></button>').appendTo(controls)
            .text('Show/Update stats')
            .click(function(){
                self.showStats();
            });
        this_ref.start(which_maze);
    };
    
    ////////////////////////////
    // Binary Tree Stuf
    ////////////////////////////
    var BinaryTree = function(data) {
        this.data = data;
        this.leftChild = null;
        this.rightChild = null;
    };
    BinaryTree.prototype.addLeftChild = function(data){
        this.leftChild = new BinaryTree(data);
    };
    BinaryTree.prototype.addRightChild = function(data){
        this.rightChild = new BinaryTree(data);
    };
    BinaryTree.prototype.clone = function(){
        // clone root
        var newTree = new BinaryTree(this.data);
        
        // clone left and right if they exist
        if (this.leftChild) {
            newTree.leftChild = this.leftChild.clone();
        }
        if (this.rightChild) {
            newTree.rightChild = this.rightChild.clone();
        }
        return newTree;
    };
    BinaryTree.prototype.size = function() {
        var length = 0;
        this.preorderTraverse(function() {
            length++;
        });
        return length;
    };
    BinaryTree.prototype.preorderTraverse = function (fn) {
        var node = this;
        
        fn.call(this, node);
        if (this.leftChild) {
            this.leftChild.preorderTraverse(fn);
        }
        if (this.rightChild) {
            this.rightChild.preorderTraverse(fn);
        }
    };
    BinaryTree.prototype.crossoverWith = function (other) {     // nicer named fn
        var ret = this.subTreeCrossover(other);
        ret.trim();
        return ret;
    };
    BinaryTree.prototype.trim = function(depth) {
    depth = depth || 0;
    
    if (depth >= 6) {
        // remove children, no need to recurse further
        this.leftChild = null;
        this.rightChild = null;
    } else {    
        if (this.leftChild) {
            this.leftChild.trim(depth+1);
        }
        if (this.rightChild) {
            this.rightChild.trim(depth+1);
        }
    }
    }
    BinaryTree.prototype.subTreeCrossoverEdge = function (that) {
        // first clone (need to clone both as we use parts of both)
        var thisClone = this.clone();
        var thatClone = that.clone();
    
        // pick an edge in this and in that to crossover, -1 since there is 1 less edge than points
        var thisPoint = Math.floor(Math.random() * (thisClone.size()-1));
        var thatPoint = Math.floor(Math.random() * (thatClone.size()-1));

        // Traverse this until we find the edge we want to cut at
        var this_node_link = thisClone.findEdgeGivenCutPoint(thisPoint);
        var that_node_link = thatClone.findEdgeGivenCutPoint(thisPoint);
        
        if (this_node_link.length == 1) {
            // randomly pick
            if (Math.random() > 0.5) {
                this_node_link[0].leftChild = that_node_link[0];
            } else {
                this_node_link[0].rightChild = that_node_link[0];
            }
        } else if (this_node_link[1] === 0) {
            // replace left child
            this_node_link[0].leftChild = that_node_link[0];
        } else if (this_node_link[1] === 1){
            // replace right child
            this_node_link[0].rightChild = that_node_link[0];
        } else {
            throw "CrossoverException"
            console.log(this_node_link);
        }
        
        return thisClone;
    };
    BinaryTree.prototype.findEdgeGivenCutPoint = function (cutPoint, indent) {
        indent = indent || "";
        var node = this;
        
        if (this.leftChild) {
            cutPoint--;
            if (cutPoint <= 0) {
                return [this,0];
            }
            cutPoint = this.leftChild.findEdgeGivenCutPoint(cutPoint,indent+"    ");
            // ew, if the recursion resulting in finding a cutpoint, bubble back up
            if (!typeof cutPoint.length == "undefined") {
                return cutPoint;
            }            
        }
        if (this.rightChild) {
            cutPoint--;
            if (cutPoint <= 0) {
                return [this,1];
            }
            cutPoint = this.rightChild.findEdgeGivenCutPoint(cutPoint,indent+"    ");
            // double ew, if the recursion resulting in finding a cutpoint, bubble back up
            if (!typeof cutPoint.length == "undefined") {
                return cutPoint;
            }   
        }
        
        // If we've got to the end of this branch, and cupoint
        // isn't 0, then this means the cutpoint is in another branch
        // and so will be found by recursing elsewhere, so we need to return
        // the decremented value of cutPoint
        if (cutPoint) {
            return cutPoint
        } else {
            // Otherwise, if cutPoint is now 0, then we happen to be at a leaf
            // node
            return [this];
        }
    };
    BinaryTree.prototype.subTreeCrossover = function(that) {
        // first clone (need to clone both as we use parts of both)
        var thisClone = this.clone();
        var thatClone = that.clone();
        
        // The node to replace in this, and the node to replace it with from that
        var thisPointIndex = Math.floor(Math.random() * thisClone.size());
        var thatPointIndex = Math.floor(Math.random() * thatClone.size());
        
        // References to the nodes to swap
        var thisNode = null, thatNode = null;
        
        // Iterate through until we find the nodes we want...
        thisClone.preorderTraverse(function(node){
            if ( thisPointIndex == 0 ) {
                thisNode = node;
            }
            thisPointIndex--;
        });
        thatClone.preorderTraverse(function(node){
            if ( thatPointIndex == 0 ) {
                thatNode = node;
            } 
            thatPointIndex--;
        });
        
        // Stop the tree from tending towards 1 angle
        if (!thisClone.leftChild || !thisClone.rightChild) {
            if (!thisClone.leftChild) {
                thisClone.leftChild = thatNode;
            } else {
                thisClone.rightChild = thatNode;
            }
        } else {
            // And copy
            thisNode.data = thatNode.data;
            thisNode.leftChild  = thatNode.leftChild;
            thisNode.rightChild = thatNode.rightChild;
        }

        return thisClone;
    }
    BinaryTree.prototype.pprint = function() {
        var str = "[" + this.data;
        if (this.leftChild) {
            str += ", " + this.leftChild.pprint();
        }
        if (this.rightChild) {
            str += ", " + this.rightChild.pprint();
        }
        str += "]";
        return str;
    };
    BinaryTree.prototype.hasEmptyLink = function() {
        return ( !(this.leftChild) || !(this.rightChild) );
    };
    ////////////////////////////
    // Angle Stuff
    ////////////////////////////
    this.deg2rad = function(d){
        return d * (Math.PI / 180.0);
    };
    this.rad2deg = function(r){
        return r * (180.0/Math.PI);
    };
    this.angleFromNorth = function (centre, p1) {
        var p0 =    [
                        centre[0], 
                        centre[1] - Math.sqrt(Math.abs(p1[0] - centre[0]) * 
                            Math.abs(pp1[0] - centre[0]) + Math.abs(p1[1] - centre[1]) *
                            Math.abs(p1[1] - centre[1]))
                    ];
        return (2 * Math.atan2(p1[1] - p0[1], p1[0] - p0[0])) * 180 / Math.PI;
    };
    this.getPointAt = function(centre, radius, angle) {
        angle = deg2rad(angle);
        return  [   
                    centre[0] + Math.sin(Math.PI - angle) * radius,
                    centre[1] + Math.cos(Math.PI - angle) * radius
                ];
    };
    
    return self;
})(jQuery, document.getElementById('canvas'), document.getElementById('status'), document.getElementById('controls'));
