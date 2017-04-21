/**
 * Copyright (C) 2011, 2016 by Fantasy Interactive, Fantasive
 */
(function($) {
  "use strict";
  $(document).ready(function() {
    
        
    var FI        = FI || {};
    FI.PointCloud = new function() {

      // Internal vars
      var $container      = $('#container'),

          renderer        = null,
          scene           = null,
          camera          = null,
          width           = $container.innerWidth() - 5,
          height          = $container.innerHeight() - 5,
          aspect          = width / height,
          logoMesh        = null,
          callbacks       = null,
          mouseDown       = false,
          trackedLogo     = false,
          me              = this,
          canvas          = null,
          context         = null,
          logo            = new Image(),
          vertices        = [],
          vertCount       = 0,
          orb             = null,
          orbInfluence    = 0.001,
          camPhase        = 0,

      // Constants
          ORB_RADIUS      = 10,
          DEPTH           = 1100,
          NEAR            = 0.1,
          FAR             = 2000,
          VIEW_ANGLE      = 65,
          STEP_X          = 5,
          STEP_Y          = 5,
          IMAGE_WIDTH     = 487,
          IMAGE_HEIGHT    = 652,
          FLOOR           = -250,
          GRAVITY         = -0.6;

      // GUI variables
      this.invertedColors = false;
      this.springToLogo   = true;
      this.cameraSpeed    = 0;
      this.springStrength = 5;
      this.springDampen   = 2.5;
      this.orbStrength    = 1000;

      /**
       * Initialize the scene
       */
      this.init = function() {

        // now create the camera and renderer
        renderer            = new A3.R(width, height, {clearColor: new A3.V4(0,0,0,0)}),
        scene               = new A3.Scene(),
        camera              = new A3.Camera(VIEW_ANGLE, aspect, NEAR, FAR);

        // create a canvas for the logo
        canvas              = $('<canvas/>')[0];
        canvas.width        = IMAGE_WIDTH;
        canvas.height       = IMAGE_HEIGHT;
        context             = canvas.getContext('2d');

        // load in the Linkticle logo and draw
        // it into the canvas
        logo.onload         = function() {
          context.drawImage(logo, 0, 0);
          setup();
        }
        logo.src            = "assets/img/linkticle_bw.png";

        // update the camera
        camera.position.z   = DEPTH;
        camera.position.y   = 100;
        camera.target.y     = 250;

        $container.append(renderer.domElement);
        $container.bind('selectstart', false);
      
        $(canvas).attr('id','logo');

      };

      /**
       * Creates the objects, GUI, event listeners
       * and finally starts the render process
       */
      function setup() {
    
        createObjects();
        //createGUI();
        addEventListeners();
        render();

      }

      /**
       * Adds the Google Data Arts GUI
       */
      function createGUI() {

        var gui = new DAT.GUI({height:95, width: 300}),
        $gui    = $('#guidat');

        //gui.add(FI.PointCloud, 'springToLogo').name('Maintain Logo');
        /*gui.add(FI.PointCloud, 'invertedColors').name('Inverted Colors').onChange(function() {

          var c = 0, col = 1-me.invertedColors;

          // switch the colors depending on the mode
          if(me.invertedColors) {

            for(c = 0; c < logoMesh.geometry.colors.length; c++) {
              logoMesh.geometry.colors[c] = vertices[c].altColor;
            }

          } else {

            for(c = 0; c < logoMesh.geometry.colors.length; c++) {
              logoMesh.geometry.colors[c] = vertices[c].color;
            }
          }

          // update the blend type and the clear colour
          logoMesh.blendType = me.invertedColors ? A3.Constants.BLEND_TYPES.ADDITIVE : A3.Constants.BLEND_TYPES.NORMAL;
          renderer.gl.clearColor(col, col, col, 1);

          // update the orb
          for(var c = 0; c < orb.geometry.colors.length; c++) {
            orb.geometry.colors[c].x = me.invertedColors;
            orb.geometry.colors[c].y = me.invertedColors;
            orb.geometry.colors[c].z = me.invertedColors;
          }

          // flag that we have changed colours of objects
          orb.geometry.updateVertexColorArray();
          logoMesh.geometry.updateVertexColorArray();

        });*/
        gui.add(FI.PointCloud, 'springStrength').name('Logo Spring Strength').min(1).max(10).step(1);
        gui.add(FI.PointCloud, 'springDampen').name('Logo Spring Dampen').min(1).max(9.5).step(0.5);
        gui.add(FI.PointCloud, 'orbStrength').name('Orb Strength').min(10).max(2000).step(10);
        //gui.add(FI.PointCloud, 'cameraSpeed').name('Camera Speed').min(0).max(5).step(1);
      }

      /**
       * Updates the particle velocities by assessing the forces
       * that are acting on each. Uses simple euler integration
       */
      function updateParticles() {

        var orbVertexInfluenceSq  = 0,
            distance              = new A3.V3(),
            velocity              = new A3.V3(),
            spring                = new A3.V3(),
            vertex                = null,
            sqDistance            = 0;

        // grow or shrink the orb
        if(mouseDown) {
          orbInfluence += (1 - orbInfluence) * .07;
        } else {
          orbInfluence += (0.001 - orbInfluence) * .3;
        }
        orb.scale.set(orbInfluence, orbInfluence, orbInfluence);

        // set the orb's influence to its radius squared
        orbVertexInfluenceSq = ORB_RADIUS * orbInfluence;
        orbVertexInfluenceSq *= orbVertexInfluenceSq;

        // now traverse the vertices
        for(var v = 0; v < vertCount; v++) {

          // cache the vertex
          vertex      = vertices[v];
          sqDistance  = 0;

          // find out how far the vertex is from the orb
          distance.copy(orb.position).subtract(vertex.position);

          // get the squared distance
          sqDistance  = squaredLength(distance);

          // copy the distance as the velocity direction
          velocity.copy(distance.normalize());

          if(mouseDown) {

            // scale is up by the particle mass and the orb's strength
            // then dampen by the distance squared of the particle to the orb
            velocity.multiplyByScalar((orbInfluence * me.orbStrength * vertex.mass) / (sqDistance * .05));
            vertex.velocity.add(velocity);

            // if the particle is within the outer bound
            // of the orb, declare it as hit and
            // force it to hold at that position
            if(sqDistance < orbVertexInfluenceSq * 4) {

              vertex.hit = true;
              vertex.position.copy(orb.position).subtract(distance.multiplyByScalar(ORB_RADIUS * orbInfluence * 2));
              vertex.velocity.multiplyByScalar(0.7);

            } else {

              vertex.hit = false;

            }

          } else {

            // if when we release this particle it
            // is being held by the orb cause it
            // to bounce away
            if(vertex.hit) {
              vertex.hit = false;
              vertex.velocity.multiplyByScalar(-.55);
              explodeVertex(vertex);
            }

            // add gravity when the mouse isn't used
            vertex.velocity.y += GRAVITY;

          }

          // if the particles are bound to the logo
          // have them spring towards it
          if(me.springToLogo) {

            // work from the vector of the vertex to its start position
            spring.copy(vertex.basePosition).subtract(vertex.position);

            // update the velocity
            vertex.velocity.add(spring.multiplyByScalar(me.springStrength * 0.01));
            vertex.velocity.multiplyByScalar(me.springDampen * 0.1);
          }

          // if we've switched from springing to not
          // or vice versa we need to handle this change
          if(trackedLogo != me.springToLogo) {
            if(me.springToLogo) {
              vertex.velocity.zero();
            } else {
              explodeVertex(vertex);
            }
          }

          // finally add the velocity to the position
          vertex.position.add(vertex.velocity);

          // now bounce the particle if it hits the floor
          if(vertex.position.y <= FLOOR) {
            vertex.position.y = FLOOR;
            vertex.velocity.y *= -0.3;
            vertex.velocity.x *= 0.55;
            vertex.velocity.z *= 0.55;
          }

        }

        // now flag that the vertex positions have changed
        logoMesh.geometry.updateVertexPositionArray();

        // move the camera
        camPhase            += me.cameraSpeed * 0.004;
        camera.position.x   = Math.sin(camPhase) * DEPTH;
        camera.position.z   = Math.cos(camPhase) * DEPTH;

        trackedLogo         = me.springToLogo;
      }

      /**
       * Cause a vertex to pop away at random from its
       * current position
       *
       * @param {A3.Core.Objects.Geometric.Vertex} vertex The vertex to pop
       */
      function explodeVertex(vertex) {
        vertex.velocity.x = Math.random() * 10 - 5;
        vertex.velocity.y = 10 + Math.random() * 10;
        vertex.velocity.z = Math.random() * 10 - 5;
      }

      /**
       * Calculates the squared length of a Vector3
       *
       * @param {A3.Core.Math.Vector3} vector The vector to calculate
       */
      function squaredLength(vector) {
        return (vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
      }

      /**
       * Creates the particle mesh and the orb
       */
      function createObjects() {

        // parse the image
        var imageData         = context.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT),
            colors            = [],
            x                 = 0,
            y                 = 0,
            logoParticle      = null;

        // go through the x & y of the image in
        // the steps
        for(var x = 0; x < IMAGE_WIDTH; x += STEP_X) {
          for(var y = 0; y < IMAGE_HEIGHT; y += STEP_Y) {

            // @see https://developer.mozilla.org/en/html/canvas/pixel_manipulation_with_canvas
            if(imageData.data[(y * IMAGE_WIDTH * 4) + (x * 4) + 3] > 0) {

              // create a new vertex for the particle
              logoParticle              = new A3.Vertex(x - IMAGE_WIDTH * 0.5, y, 0);
              logoParticle.mass         = 1 + Math.random();
              logoParticle.basePosition = new A3.V3().copy(logoParticle.position);
              logoParticle.velocity     = new A3.V3();

              // assign the colours to the particle
              logoParticle.color        = new A3.V3(1,1,1);//#538984
              logoParticle.altColor     = new A3.V3(x / IMAGE_WIDTH, y / IMAGE_HEIGHT, 1-(x / IMAGE_WIDTH));
              vertices.push(logoParticle);

              colors.push(logoParticle.color);
            }
          }
        }

        // cache the vertex count
        vertCount = vertices.length;

        // now create the mesh for the logo
        logoMesh = new A3.Mesh({
          geometry: new A3.Geometry({
            vertices: vertices,
            colors: colors}),
          shader: A3.ShaderLibrary.get({
            type: "Particle",//Pink,Basic,Particle,Normals,Phong
            particleSize: 32,
            texture: new A3.Texture("assets/img/particle.png")
          }),
          renderType: "Particle",
          depthTest: false,
          transparent: true,
          opacity: 0.3
        });

        // and for the orb
        orb = new A3.Mesh({
          geometry: new A3.Sphere(ORB_RADIUS,20,20),
          shader: A3.ShaderLibrary.get({type:"Basic"})
        });

        // now set the orb's colour to black
        for(var c = 0; c < orb.geometry.colors.length; c++) {
          orb.geometry.colors[c].x = 0;
          orb.geometry.colors[c].y = 0;
          orb.geometry.colors[c].z = 0;
        }

        // update the orb's colours and size
        orb.geometry.updateVertexColorArray();
        orb.scale.multiplyByScalar(orbInfluence);

        scene.add(logoMesh);
        scene.add(orb);
      }

      /**
       * Uses the mouse position to calculate the position for
       * the orb. Casts a ray into the scene and positions it
       * at a fixed distance from the camera
       *
       * @param {Number} mouseX The X position of the mouse cursor
       * @param {Number} mouseY The Y position of the mouse cursor
       */
      function moveOrbTo(mouseX, mouseY) {

        // push the x and y into a vector2, but invert the
        // mouse y to match the WebGL coordinate system
        var vector      = new A3.V2( (mouseX / width) * 2 - 1,
                                    -(mouseY / height) * 2 + 1),
            projector   = new A3.Projector(camera),
            direction   = projector
                            .unproject(vector)
                            .normalize()
                            .multiplyByScalar(DEPTH),
            ray         = new A3.Ray(camera.position, direction);

        // finally reposition the orb
        orb.position.x  = ray.origin.x - ray.direction.x;
        orb.position.y  = Math.max(-140, ray.origin.y - ray.direction.y);
        orb.position.z  = ray.origin.z - ray.direction.z;

      }

      /**
       * Sets up the event listeners
       */
      function addEventListeners() {

        /*
         * Set up the callbacks
         */
        callbacks = {

          /**
           * When the mouse button is depressed
           *
           * @param {Event} event The mouse press event
           */
          onMouseDown: function(event) {

            var thisMouseX  = event.clientX,
                thisMouseY  = event.clientY;

            mouseDown = true;

            moveOrbTo(thisMouseX, thisMouseY);
            me.springToLogo = !me.springToLogo;
          },

          /**
           * When the mouse button is released
           *
           * @param {Event} event The mouse release event
           */
          onMouseUp: function(event) {
            mouseDown = false;
          },

          /**
           * When the mouse moves
           *
           * @param {Event} event The mouse move event
           */
          onMouseMove: function(event) {

            if(mouseDown) {
              var thisMouseX  = event.clientX,
                  thisMouseY  = event.clientY;

              moveOrbTo(thisMouseX, thisMouseY);
            }
          },

          /**
           * When the window resizes
           */
          onWindowResize: function() {
            
            setScreensSize();

            width         = $container.width();
            height        = $container.height();
            aspect        = width / height;

            // recalculate the WebGL context
            renderer.resize(width, height);
            camera.projectionMatrix.perspective(VIEW_ANGLE, aspect, NEAR, FAR);

          }
        }

        // finally bind on the listeners
        //$container.mousedown(callbacks.onMouseDown);
        //$container.mouseup(callbacks.onMouseUp);
        //$container.mousemove(callbacks.onMouseMove);
        $(window).resize(callbacks.onWindowResize).trigger('resize');

      }

      this.fireMouseCallbacks = function() {
        $container.mousedown(callbacks.onMouseDown);
        $container.mouseup(callbacks.onMouseUp);
        $container.mousemove(callbacks.onMouseMove);
      }

      /**
       * Do a render
       */
      function render() {
    
        // schedule the next render
        requestAnimFrame(render);

        // update the physics
        updateParticles();

        // draw
        renderer.render(scene, camera);

      }
      
      this.explode = function() {
        me.springToLogo = false;
      }
      
      this.implode = function() {
        me.springToLogo = true;
      }
      
    };

    
        
    $.fn.linkticle = function(options) {
      
      options = $.extend({
        "verticalCentered": true,
        'resize': true,
        'sectionsColor' : [],
        'anchors':[],
        'scrollingSpeed': 700,
        'easing': 'easeInQuart',
        'menu': false,
        'navigation': false,
        'navigationPosition': 'right',
        'navigationColor': '#000',
        'navigationTooltips': [],
        'slidesNavigation': false,
        'slidesNavPosition': 'bottom',
        'controlArrowColor': '#fff',
        'loopBottom': false,
        'loopTop': false,
        'loopHorizontal': true,
        'autoScrolling': true,
        'scrollOverflow': false,
        'css3': false,
        'paddingTop': 0,
        'paddingBottom': 0,
        'fixedElements': null,
        'normalScrollElements': null,
        'keyboardScrolling': true,
        'touchSensitivity': 5,
        'continuousVertical': false,
        'animateAnchor': true,
        'normalScrollElementTouchThreshold': 5,
        'sectionSelector': '.section',
        'slideSelector': '.slide',

        //events
        'afterLoad': null,
        'onLeave': null,
        'afterRender': null,
        'afterResize': null,
        'afterSlideLoad': null,
        'onSlideLeave': null
      }, options);
      
      var scrollId;
      var isScrolling = false;
      var isMoving = false;
      var lastScroll = 0;
      var delta = 5;
      var mouseIsDown = false;
      var timer;
      
      $(window).on('scroll', scrollHandler);
      document.addEventListener('mousedown', onMouseScrollDown);
      document.addEventListener('mouseup', onMouseScrollUp);
      
      function scrollHandler(e) {
        e.preventDefault();
        if (isMoving || isScrolling) return;
        if (mouseIsDown) return;
        //console.log('now scrolling');
        
        var currentScroll = $(window).scrollTop();
        
        if (Math.abs(lastScroll - currentScroll) >= delta) {
          isScrolling = true;
          if (lastScroll < currentScroll) {
            scrolling('down', 'html,body');
          } else {
            scrolling('up', 'html,body');
          }
        }
        
      }

      function onMouseScrollDown(e){
        //console.log('mouse down');
        mouseIsDown = true;
        resetTimer();
      }

      function onMouseScrollUp(e){
        //console.log('mouse up');
        mouseIsDown = false;
        scrollHandler(e);
      }
      
      function removeMouseWheelHandler(){
        if (document.addEventListener) {
          document.removeEventListener('mousewheel', MouseWheelHandler, false); //IE9, Chrome, Safari, Oper
          document.removeEventListener('wheel', MouseWheelHandler, false); //Firefox
        } else {
          document.detachEvent("onmousewheel", MouseWheelHandler); //IE 6/7/8
        }
      }
      
      function addMouseWheelHandler(){
        if (document.addEventListener) {
          document.addEventListener("mousewheel", MouseWheelHandler, false); //IE9, Chrome, Safari, Oper
          document.addEventListener("wheel", MouseWheelHandler, false); //Firefox
        } else {
          document.attachEvent("onmousewheel", MouseWheelHandler); //IE 6/7/8
        }
      }
      
      /**
       * Detecting mousewheel scrolling
       *
       * http://blogs.sitepointstatic.com/examples/tech/mouse-wheel/index.html
       * http://www.sitepoint.com/html5-javascript-mouse-wheel/
       */
      function MouseWheelHandler(e) {
        e.preventDefault();
        if (isMoving || isScrolling) return;
        //console.log('now wheel scrolling');
        //console.log(e);
        if(options.autoScrolling){
          // cross-browser wheel delta
          e = window.event || e;
          var delta = Math.max(-1, Math.min(1,
              (e.wheelDelta || -e.deltaY || -e.detail)));

          var scrollable = 'html,body';

          if (!isMoving) { //if theres any #
            //scrolling down?
            if (delta < 0) {
              scrolling('down', scrollable);
            //scrolling up?
            } else {
              scrolling('up', scrollable);
            }
          }
          return false;
        }
      }
      
      function scrolling(way, obj) {
        isMoving = true;
        switch (way) {
          case 'down':
            if (currentSection < sections.length-1) {
              currentSection++;
            } else if (currentSection == sections.length) {
              // if left empty #
            } else {
              currentSection = sections.length;
            }
            //console.log('scrolling down to section '+currentSection);
            break;
          case 'up':
            if (currentSection > 0) {
              currentSection--;
            } else if (currentSection == sections.length) {
              currentSection = sections.length - 1;
            }
            //console.log('scrolling up to section '+currentSection);
            break;
        }
        if (currentSection < sections.length) {
          var _h = 0;
          var sceneTop = Math.round($(sections[currentSection]).offset().top);
          var offset = sceneTop;// - _h;
          //$(obj).animate({
          //  scrollTop: offset+"px"
          //}, 700, finishMoving);
          TweenMax.to(window, 0.6, {scrollTo:$(sections[currentSection]).offset().top, onComplete:finishMoving});
        } else {
          // isScrolling = false;
          // isMoving = false;
          finishMoving();
        }
      }
      
      function finishMoving() {
        //console.log('moving finish');
        if ($(this).is('body')) return;
        
        lastScroll = $(window).scrollTop();
        
        clearTimeout(scrollId);
        scrollId = setTimeout(function(){
          isScrolling = false;
          isMoving = false;
        }, 100);
      }
    
      function resetTimer(){
         clearTimeout(timer);
         //timer = setTimeout(gotoProjects, 1500);
      }

      function gotoProjects(){
        resetTimer();
        if(currentSection==0){
          scrolling('down', 'html,body');
        }
      }
      
      $.fn.linkticle.getMoving = function(){
        return isMoving;
      };

      $.fn.linkticle.startTimer = function(){
        resetTimer();
        timer = setTimeout(gotoProjects, 100);
      }
      
      addMouseWheelHandler();
      
    };

    
    var $body = $('body');
    var sections = $('section.onepage');
    var currentSection = 0;
    //console.log(sections);

    var _width = $(window).width();
    $body.attr('data-resolution', _width + 'px');
    $body.attr('data-touch', Modernizr.touchevents);

    // SVG to PNG fallback
    if(!Modernizr.svg) {
        $('img[src*="svg"]').attr('src', function() {
            return $(this).attr('src').replace('.svg', '.png');
        });
    } else {
      /*  Replace all SVG images with inline SVG */
      $('img.svg').each(function(){
        var $img = $(this);
        var imgID = $img.attr('id');
        var imgClass = $img.attr('class');
        var imgURL = $img.attr('src');

        $.get(imgURL, function(data) {
           //Get the SVG tag, ignore the rest
          var $svg = $(data).find('svg');
           //Add replaced image\'s ID to the new SVG
          if (typeof imgID !== 'undefined') {
            $svg = $svg.attr('id', imgID);
          }
           //Add replaced image\'s classes to the new SVG
          if (typeof imgClass !== 'undefined') {
            $svg = $svg.attr('class', imgClass+' replaced-svg');
          }
           //Remove any invalid XML tags as per http:validator.w3.org
          $svg = $svg.removeAttr('xmlns:a');
           //Replace image with new SVG
          $img.replaceWith($svg);
        });
      });
    }

    setScreensSize();
    // Create Linkitcle particle logo
    if(Modernizr.webgl) {
      //$('.onepage').css({'padding-top': $('.top-bar').outerHeight()});
      FI.PointCloud.init();
      if (!$body.data('touch')) $body.linkticle();
      //setTimeout(FI.PointCloud.explode, 400);
      TweenMax.delayedCall(0.3, FI.PointCloud.explode);
      
    } else {
      $("#container")
        .addClass('error')
        .html("<h1>Sorry, it has not been possible to start a WebGL context.</h1>");
    }

    $(document).foundation();
    $('.title-bar').on('sticky.zf.stuckto:top', function(){
      $(this).addClass('shrink');
    }).on('sticky.zf.unstuckfrom:top', function(){
      $(this).removeClass('shrink');
    });
    //console.log('page loaded');
    //$(window).trigger('resize');
    
    // Set Onepage Intro elements and animations
    var $backgroundImg = $('.main-background');
    TweenMax.set($backgroundImg, {opacity:0});
    TweenMax.to($backgroundImg, 2, {opacity:1, ease:Power2.easeInOut, delay:.5});
    TweenMax.to($backgroundImg, 360, {y:-3e3, ease:Linear.easeNone, delay:.2, repeat:-1});// should be on desktop only
    
    var $canvas = $('#container');
    TweenMax.set($canvas, {opacity:0});
    TweenMax.to($canvas, .2, {opacity:1, ease:Power2.easeInOut, delay:.2});
    
    var $text1 = $('.texts .text1');
    var $text2 = $('.texts .text2');
    TweenMax.set($text1, {transformPerspective:500, z:-500});
    TweenMax.to($text1, 3.6, {opacity:1, z:0, ease:Power2.easeOut, delay:1.5});
    TweenMax.to($text1, 1, {autoAlpha:0, z:1000, ease:Power2.easeIn, delay: 5.0, onComplete:removeElement, onCompleteParams:$text1});
    
    TweenMax.set($text2, {transformPerspective:500, z:-500});
    TweenMax.to($text2, 3.3, {opacity:1, z:0, ease:Power2.easeOut, delay:5.7});
    TweenMax.to($text2, 120, {autoAlpha:0, z:1000, ease:Power2.easeIn, delay: 8.9, onComplete:removeElement, onCompleteParams:$text2});
    
    TweenMax.delayedCall(5.5, FI.PointCloud.implode);
    TweenMax.delayedCall(9.5, FI.PointCloud.fireMouseCallbacks);
    if (!$body.data('touch')) TweenMax.delayedCall(15, $body.linkticle.startTimer);

    function removeElement(el) {
      $(el).hide();
    }

    function setScreensSize() {
      if (!$body.data('touch')) {
        $('.onepage').width( $(window).innerWidth() ).height( $(window).innerHeight() );
      } else {
        $('.onepage#intro').width( $(window).innerWidth() ).height( $(window).innerHeight() );
      }
      $('#container').width( $(window).innerWidth() ).height( $(window).innerHeight() );
    }
    
  });// document ready

}(jQuery));



var OS = {
  isWindows: function isWindows() {
    return navigator.appVersion.indexOf("Win") != -1;
  },
  isMac: function isMac() {
    return navigator.appVersion.indexOf("Mac") != -1;
  },
  isUnix: function isUnix() {
    return navigator.appVersion.indexOf("X11") != -1;
  },
  isLinux: function isLinux() {
    return navigator.appVersion.indexOf("Linux") != -1;
  },
  name: function name() {
    var name = '';
    if (OS.isWindows()) name = "windows";else if (OS.isMac()) name = "macosx";else if (OS.isUnix()) name = "unix";else if (OS.isLinux()) name = "linux";
    return name;
  }
};

navigator.sayswho = function () {
  var ua = navigator.userAgent,
      tem,
      M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  if (/trident/i.test(M[1])) {
    tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return 'IE ' + (tem[1] || '');
  }
  if (M[1] === 'Chrome') {
    tem = ua.match(/\bOPR\/(\d+)/);
    if (tem != null) return 'Opera ' + tem[1];
  }
  M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
  if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
  return M.join(' ');
}();