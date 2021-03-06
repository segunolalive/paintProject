function elt(name, attributes) {
  var node = document.createElement(name);
  if (attributes) {
    for (var attr in attributes)
      if (attributes.hasOwnProperty(attr))
        node.setAttribute(attr, attributes[attr]);
  }
  for (var i = 2; i < arguments.length; i++) {
    var child = arguments[i];
    if (typeof child == "string")
      child = document.createTextNode(child);
    node.appendChild(child);
  }
  return node;
}

var controls = Object.create(null);

function createPaint(parent) {
  var canvas = elt("canvas", {width: 500, height: 300});
  var cx = canvas.getContext("2d");
  var toolbar = elt("div", {class: "toolbar"});
  for (var name in controls)
    toolbar.appendChild(controls[name](cx));

  var panel = elt("div", {class: "picturepanel"}, canvas);
  parent.appendChild(elt("div", null, panel, toolbar));
}

var tools = Object.create(null);

controls.tool = function(cx) {
  var select = elt("select");
  for (var name in tools)
    select.appendChild(elt("option", null, name));

  cx.canvas.addEventListener("mousedown", function(event) {
    if (event.which == 1) {
      tools[select.value](event, cx);
      event.preventDefault();
    }
  });

  return elt("span", null, "Tool: ", select);
};

function relativePos(event, element) {
  var rect = element.getBoundingClientRect();
  return {x: Math.floor(event.clientX - rect.left),
          y: Math.floor(event.clientY - rect.top)};
}

function trackDrag(onMove, onEnd) {
  function end(event) {
    removeEventListener("mousemove", onMove);
    removeEventListener("mouseup", end);
    if (onEnd)
      onEnd(event);
  }
  addEventListener("mousemove", onMove);
  addEventListener("mouseup", end);
}


tools.Line = function(event, cx, onEnd) {
  cx.lineCap = "round";

  var pos = relativePos(event, cx.canvas);

  trackDrag(function(event) {
    cx.beginPath();
    cx.moveTo(pos.x, pos.y);
    pos = relativePos(event, cx.canvas);    
    cx.lineTo(pos.x, pos.y);
    cx.stroke();

  }, onEnd);
};

tools.Erase = function(event, cx) {
  cx.globalCompositeOperation = "destination-out";
  tools.Line(event, cx, function() {
    cx.globalCompositeOperation = "source-over";
  });
};


tools.Rectangle = function(event, cx) {
  // Your code here.
  var rectStart = {x: event.pageX, y: event.pageY}
  var startPos = relativePos(event, cx.canvas)

  var div = document.createElement("div")
  div.setAttribute("id", "rectDiv")
  div.style.background = cx.fillStyle
  div.style.position = "absolute" 
  document.body.appendChild(div)

  function findRect (a, b) {
    return {
      top : Math.min(a.y, b.y),
      left : Math.min(a.x, b.x),
      width: Math.abs(Math.floor(a.x - b.x)),
      height: Math.abs(Math.floor(a.y - b.y))       
    }    
  }
  
  trackDrag(function(event) {
    var currentPos = {x: event.pageX, y: event.pageY}
    var rect = findRect (rectStart, currentPos)    
    for (key in rect) {
      if (rect.hasOwnProperty(key))
        div.style[key] = rect[key] + "px"
    }    
  }, function (event) {
    var endPos = relativePos(event, cx.canvas);
    var rect = findRect (startPos, endPos)
    cx.fillRect(rect.left, rect.top, rect.width, rect.height);
    document.body.removeChild(div)
  });
};


function rgb2hex (colorArray) {
  var hex = "#"
  function hexComponent(c){
    if (typeof c == "number")
      var hex = c.toString(16)
      return hex.length == 1 ? "0" + hex : hex;
  }
  for (var i = 0; i < 3; i++){
    hex += hexComponent(colorArray[i])
  }
  return hex
}


tools["Pick color"] = function(event, cx) {
  // Your code here.
  try {
    var pos = relativePos(event, cx.canvas)
    var data = cx.getImageData(pos.x, pos.y, 1, 1)
    var color = data.data
  }
  catch(e) {
    if (e instanceof "SecurityError") {
      alert("Unable to sample color. Protected Image")
      return
    }
    else{
      throw e
    }
  }

  color = rgb2hex(color)

  var colorInput = document.querySelector("input[type=color]")
  colorInput.value = color
  cx.fillStyle = color
  cx.strokeStyle = color
};


function fillCanvas (event) {
  removeEventListener('click', fillCanvas)
}

function colorAtPixel (x, y, cx) {
  var data = cx.getImageData(x, y, 1, 1).data;
  var pixelColor = data.join('');
  return pixelColor;
}

function neighboringPixels(point, check){
  check({x: point.x + 1, y: point.y})
  check({x: point.x - 1, y: point.y})
  check({x: point.x, y: point.y + 1})
  check({x: point.x, y: point.y - 1})
}

tools["Flood fill"] = function(event, cx){
  var pos = relativePos(event, cx.canvas)
  var data = cx.getImageData(pos.x, pos.y, 1, 1).data
  var startingColor = colorAtPixel(cx, pos.x, pos.y)


  console.log("color is: ", startingColor)


  addEventListener('click', fillCanvas)
}

controls.color = function(cx) {
  var input = elt("input", {type: "color"});
  input.addEventListener("change", function() {
    cx.fillStyle = input.value;
    cx.strokeStyle = input.value;
  });
  return elt("span", null, "Color: ", input);
};

controls.brushSize = function(cx) {
  var select = elt("select");
  var sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];
  sizes.forEach(function(size) {
    select.appendChild(elt("option", {value: size},
                           size + " pixels"));
  });
  select.addEventListener("change", function() {
    cx.lineWidth = select.value;
  });
  return elt("span", null, "Brush size: ", select);
};

controls.save = function(cx) {
  var link = elt("a", {href: "/"}, "Save");
  function update() {
    try {
      name = prompt('Save image as: ');      
      // link.download = name;
    } catch (e) {
      if (e instanceof SecurityError)
        link.href = "javascript:alert(" +
          JSON.stringify("Can't save: " + e.toString()) + ")";
      else
        throw e;
    }
  }
  link.addEventListener("mouseover", update);
  link.addEventListener("focus", update);
  return link;
};

function loadImageURL(cx, url) {
  var image = document.createElement("img");
  image.addEventListener("load", function() {
    var color = cx.fillStyle, size = cx.lineWidth;
    cx.canvas.width = image.width;
    cx.canvas.height = image.height;
    cx.drawImage(image, 0, 0);
    cx.fillStyle = color;
    cx.strokeStyle = color;
    cx.lineWidth = size;
  });
  image.src = url;
}

controls.openFile = function(cx) {
  var input = elt("input", {type: "file"});
  input.addEventListener("change", function() {
    if (input.files.length == 0) return;
    var reader = new FileReader();
    reader.addEventListener("load", function() {
      loadImageURL(cx, reader.result);
    });
    reader.readAsDataURL(input.files[0]);
  });
  return elt("div", null, "Open file: ", input);
};

controls.openURL = function(cx) {
  var input = elt("input", {type: "text"});
  var form = elt("form", null,
                 "Open URL: ", input,
                 elt("button", {type: "submit"}, "load"));
  form.addEventListener("submit", function(event) {
    event.preventDefault();
    loadImageURL(cx, input.value);
  });
  return form;
};

tools.Text = function(event, cx) {
  var text = prompt("Text:", "");
  if (text) {
    var pos = relativePos(event, cx.canvas);
    cx.font = Math.max(7, cx.lineWidth) + "px sans-serif";
    cx.fillText(text, pos.x, pos.y);
  }
};

tools.Spray = function(event, cx) {
  var radius = cx.lineWidth / 2;
  var area = radius * radius * Math.PI;
  var dotsPerTick = Math.ceil(area / 30);

  var currentPos = relativePos(event, cx.canvas);
  var spray = setInterval(function() {
    for (var i = 0; i < dotsPerTick; i++) {
      var offset = randomPointInRadius(radius);
      cx.fillRect(currentPos.x + offset.x,
                  currentPos.y + offset.y, 1, 1);
    }
  }, 25);
  trackDrag(function(event) {
    currentPos = relativePos(event, cx.canvas);
  }, function() {
    clearInterval(spray);
  });
};

function randomPointInRadius(radius) {
  for (;;) {
    var x = Math.random() * 2 - 1;
    var y = Math.random() * 2 - 1;
    if (x * x + y * y <= 1)
      return {x: x * radius, y: y * radius};
  }
}


createPaint(document.body)