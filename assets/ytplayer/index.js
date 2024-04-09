/*! yt-player. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
var $jscomp = {
    scope: {},
    global: this,
    initSymbolIterator: function () {
      Symbol = $jscomp.global.Symbol || {};
      Symbol.iterator || (Symbol.iterator = "$jscomp$iterator");
      $jscomp.initSymbolIterator = function () {};
    },
    makeIterator: function (a) {
      $jscomp.initSymbolIterator();
      if (a[Symbol.iterator]) return a[Symbol.iterator]();
      if (!(a instanceof Array) && "string" != typeof a) throw Error();
      var b = 0;
      return {
        next: function () {
          return b == a.length ? { done: !0 } : { done: !1, value: a[b++] };
        },
      };
    },
    inherits: function (a, b) {
      function c() {}
      c.prototype = b.prototype;
      a.prototype = new c();
      a.prototype.constructor = a;
      for (var d in b)
        if ($jscomp.global.Object.defineProperties) {
          var e = $jscomp.global.Object.getOwnPropertyDescriptor(b, d);
          void 0 !== e && $jscomp.global.Object.defineProperty(a, d, e);
        } else a[d] = b[d];
    },
  },
  EventEmitter = function () {
    this.events = {};
  };
EventEmitter.prototype.on = function (a, b) {
  "object" !== typeof this.events[a] && (this.events[a] = []);
  this.events[a].push(b);
};
EventEmitter.prototype.removeListener = function (a, b) {
  var c;
  "object" === typeof this.events[a] &&
    ((c = this.indexOf(this.events[a], b)),
    -1 < c && this.events[a].splice(c, 1));
};
EventEmitter.prototype.emit = function (a) {
  var b,
    c,
    d,
    e = [].slice.call(arguments, 1);
  if ("object" === typeof this.events[a])
    for (c = this.events[a].slice(), d = c.length, b = 0; b < d; b++)
      c[b].apply(this, e);
};
EventEmitter.prototype.once = function (a, b) {
  this.on(a, function d() {
    this.removeListener(a, d);
    b.apply(this, arguments);
  });
};
var loadScript = function (a, b, c) {
    return new Promise(function (d, e) {
      var f = document.createElement("script");
      f.async = !0;
      f.src = a;
      for (
        var h = $jscomp.makeIterator(Object.entries(b || {})), g = h.next();
        !g.done;
        g = h.next()
      )
        (g = g.value), f.setAttribute(g[0], g[1]);
      f.onload = function () {
        f.onerror = f.onload = null;
        d(f);
      };
      f.onerror = function () {
        f.onerror = f.onload = null;
        e(Error("Failed to load " + a));
      };
      (
        c ||
        document.head ||
        document.getElementsByTagName("head")[0]
      ).appendChild(f);
    });
  },
  YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api",
  YOUTUBE_STATES = {
    "-1": "unstarted",
    0: "ended",
    1: "playing",
    2: "paused",
    3: "buffering",
    5: "cued",
  },
  YOUTUBE_ERROR = {
    INVALID_PARAM: 2,
    HTML5_ERROR: 5,
    NOT_FOUND: 100,
    UNPLAYABLE_1: 101,
    UNPLAYABLE_2: 150,
  },
  loadIframeAPICallbacks = [];
YouTubePlayer = function (a, b) {
  var c = this;
  EventEmitter.call(this);
  var d = "string" === typeof a ? document.querySelector(a) : a;
  this._id = d.id
    ? d.id
    : (d.id = "ytplayer-" + Math.random().toString(16).slice(2, 8));
  this._opts = Object.assign(
    {
      width: 640,
      height: 360,
      autoplay: !1,
      captions: void 0,
      controls: !0,
      keyboard: !0,
      fullscreen: !0,
      annotations: !0,
      modestBranding: !1,
      related: !0,
      timeupdateFrequency: 1e3,
      playsInline: !0,
      start: 0,
    },
    b
  );
  this.videoId = null;
  this.destroyed = !1;
  this._api = null;
  this._autoplay = !1;
  this._player = null;
  this._ready = !1;
  this._queue = [];
  this.replayInterval = [];
  this._interval = null;
  this._startInterval = this._startInterval.bind(this);
  this._stopInterval = this._stopInterval.bind(this);
  this.on("playing", this._startInterval);
  this.on("unstarted", this._stopInterval);
  this.on("ended", this._stopInterval);
  this.on("paused", this._stopInterval);
  this.on("buffering", this._stopInterval);
  this._loadIframeAPI(function (a, b) {
    if (a) return c._destroy(Error("YouTube Iframe API failed to load"));
    c._api = b;
    c.videoId && c.load(c.videoId, c._autoplay, c._start);
  });
};
$jscomp.inherits(YouTubePlayer, EventEmitter);
YouTubePlayer.prototype.indexOf = function (a, b) {
  for (var c = 0, d = a.length, e = -1, f = !1; c < d && !f; )
    a[c] === b && ((e = c), (f = !0)), c++;
  return e;
};
YouTubePlayer.prototype.load = function (a, b, c) {
  b = void 0 === b ? !1 : b;
  c = void 0 === c ? 0 : c;
  this.destroyed ||
    (this._startOptimizeDisplayEvent(),
    this._optimizeDisplayHandler("center, center"),
    (this.videoId = a),
    (this._autoplay = b),
    (this._start = c),
    this._api &&
      (this._player
        ? this._ready &&
          (b
            ? this._player.loadVideoById(a, c)
            : this._player.cueVideoById(a, c))
        : this._createPlayer(a)));
};
YouTubePlayer.prototype.play = function () {
  this._ready ? this._player.playVideo() : this._queueCommand("play");
};
YouTubePlayer.prototype.replayFrom = function (a) {
  var b = this;
  !this.replayInterval.find(function (a) {
    return a.iframeParent === b._player.i.parentNode;
  }) &&
    a &&
    this.replayInterval.push({
      iframeParent: this._player.i.parentNode,
      interval: setInterval(function () {
        if (b._player.getCurrentTime() >= b._player.getDuration() - Number(a)) {
          b.seek(0);
          for (
            var c = $jscomp.makeIterator(b.replayInterval.entries()),
              d = c.next();
            !d.done;
            d = c.next()
          )
            (d = d.value[0]),
              Object.hasOwnProperty.call(b.replayInterval, d) &&
                (clearInterval(b.replayInterval[d].interval),
                b.replayInterval.splice(d, 1));
        }
      }, 1e3 * Number(a)),
    });
};
YouTubePlayer.prototype.pause = function () {
  this._ready ? this._player.pauseVideo() : this._queueCommand("pause");
};
YouTubePlayer.prototype.stop = function () {
  this._ready ? this._player.stopVideo() : this._queueCommand("stop");
};
YouTubePlayer.prototype.seek = function (a) {
  this._ready ? this._player.seekTo(a, !0) : this._queueCommand("seek", a);
};
YouTubePlayer.prototype._optimizeDisplayHandler = function (a) {
  if (this._player) {
    var b = this._player.i;
    a = a.split(",");
    if (b) {
      var c, d;
      if ((c = b.parentElement)) {
        var e = window.getComputedStyle(c);
        d =
          c.clientHeight +
          parseFloat(e.marginTop, 10) +
          parseFloat(e.marginBottom, 10) +
          parseFloat(e.borderTopWidth, 10) +
          parseFloat(e.borderBottomWidth, 10);
        c =
          c.clientWidth +
          parseFloat(e.marginLeft, 10) +
          parseFloat(e.marginRight, 10) +
          parseFloat(e.borderLeftWidth, 10) +
          parseFloat(e.borderRightWidth, 10);
        d += 80;
        b.style.width = c + "px";
        b.style.height = Math.ceil(parseFloat(b.style.width, 10) / 1.7) + "px";
        b.style.marginTop =
          Math.ceil(-((parseFloat(b.style.height, 10) - d) / 2)) + "px";
        b.style.marginLeft = 0;
        if ((e = parseFloat(b.style.height, 10) < d))
          (b.style.height = d + "px"),
            (b.style.width =
              Math.ceil(1.7 * parseFloat(b.style.height, 10)) + "px"),
            (b.style.marginTop = 0),
            (b.style.marginLeft =
              Math.ceil(-((parseFloat(b.style.width, 10) - c) / 2)) + "px");
        for (var f in a)
          if (a.hasOwnProperty(f))
            switch (a[f].replace(/ /g, "")) {
              case "top":
                b.style.marginTop = e
                  ? -((parseFloat(b.style.height, 10) - d) / 2) + "px"
                  : 0;
                break;
              case "bottom":
                b.style.marginTop = e
                  ? 0
                  : -(parseFloat(b.style.height, 10) - d) + "px";
                break;
              case "left":
                b.style.marginLeft = 0;
                break;
              case "right":
                b.style.marginLeft = e
                  ? -(parseFloat(b.style.width, 10) - c)
                  : "0px";
                break;
              default:
                parseFloat(b.style.width, 10) > c &&
                  (b.style.marginLeft =
                    -((parseFloat(b.style.width, 10) - c) / 2) + "px");
            }
      }
    }
  }
};
YouTubePlayer.prototype.stopResize = function () {
  window.removeEventListener("resize", this._resizeListener);
  this._resizeListener = null;
};
YouTubePlayer.prototype.stopReplay = function (a) {
  for (
    var b = $jscomp.makeIterator(this.replayInterval.entries()), c = b.next();
    !c.done;
    c = b.next()
  )
    (c = c.value[0]),
      Object.hasOwnProperty.call(this.replayInterval, c) &&
        a === this.replayInterval[c].iframeParent &&
        (clearInterval(this.replayInterval[c].interval),
        this.replayInterval.splice(c, 1));
};
YouTubePlayer.prototype.setVolume = function (a) {
  this._ready ? this._player.setVolume(a) : this._queueCommand("setVolume", a);
};
YouTubePlayer.prototype.loadPlaylist = function () {
  this._ready
    ? this._player.loadPlaylist(this.videoId)
    : this._queueCommand("loadPlaylist", this.videoId);
};
YouTubePlayer.prototype.setLoop = function (a) {
  this._ready ? this._player.setLoop(a) : this._queueCommand("setLoop", a);
};
YouTubePlayer.prototype.getVolume = function () {
  return (this._ready && this._player.getVolume()) || 0;
};
YouTubePlayer.prototype.mute = function () {
  this._ready ? this._player.mute() : this._queueCommand("mute");
};
YouTubePlayer.prototype.unMute = function () {
  this._ready ? this._player.unMute() : this._queueCommand("unMute");
};
YouTubePlayer.prototype.isMuted = function () {
  return (this._ready && this._player.isMuted()) || !1;
};
YouTubePlayer.prototype.setSize = function (a, b) {
  this._ready
    ? this._player.setSize(a, b)
    : this._queueCommand("setSize", a, b);
};
YouTubePlayer.prototype.setPlaybackRate = function (a) {
  this._ready
    ? this._player.setPlaybackRate(a)
    : this._queueCommand("setPlaybackRate", a);
};
YouTubePlayer.prototype.setPlaybackQuality = function (a) {
  this._ready
    ? this._player.setPlaybackQuality(a)
    : this._queueCommand("setPlaybackQuality", a);
};
YouTubePlayer.prototype.getPlaybackRate = function () {
  return (this._ready && this._player.getPlaybackRate()) || 1;
};
YouTubePlayer.prototype.getAvailablePlaybackRates = function () {
  return (this._ready && this._player.getAvailablePlaybackRates()) || [1];
};
YouTubePlayer.prototype.getDuration = function () {
  return (this._ready && this._player.getDuration()) || 0;
};
YouTubePlayer.prototype.getProgress = function () {
  return (this._ready && this._player.getVideoLoadedFraction()) || 0;
};
YouTubePlayer.prototype.getState = function () {
  return (
    (this._ready && YOUTUBE_STATES[this._player.getPlayerState()]) ||
    "unstarted"
  );
};
YouTubePlayer.prototype.getCurrentTime = function () {
  return (this._ready && this._player.getCurrentTime()) || 0;
};
YouTubePlayer.prototype.destroy = function () {
  this._destroy();
};
YouTubePlayer.prototype._destroy = function (a) {
  this.destroyed ||
    ((this.destroyed = !0),
    this._player &&
      (this._player.stopVideo && this._player.stopVideo(),
      this._player.destroy()),
    (this._player = this._api = this._opts = this._id = this.videoId = null),
    (this._ready = !1),
    (this._queue = null),
    this._stopInterval(),
    this.removeListener("playing", this._startInterval),
    this.removeListener("paused", this._stopInterval),
    this.removeListener("buffering", this._stopInterval),
    this.removeListener("unstarted", this._stopInterval),
    this.removeListener("ended", this._stopInterval),
    a && this.emit("error", a));
};
YouTubePlayer.prototype._queueCommand = function (a, b) {
  for (var c = [], d = 1; d < arguments.length; ++d) c[d - 1] = arguments[d];
  this.destroyed || this._queue.push([a, c]);
};
YouTubePlayer.prototype._flushQueue = function () {
  for (; this._queue.length; ) {
    var a = this._queue.shift();
    this[a[0]].apply(this, a[1]);
  }
};
YouTubePlayer.prototype._loadIframeAPI = function (a) {
  if (window.YT && "function" === typeof window.YT.Player)
    return a(null, window.YT);
  loadIframeAPICallbacks.push(a);
  Array.from(document.getElementsByTagName("script")).some(function (a) {
    return a.src === YOUTUBE_IFRAME_API_SRC;
  }) ||
    loadScript(YOUTUBE_IFRAME_API_SRC).catch(function (a) {
      for (; loadIframeAPICallbacks.length; ) loadIframeAPICallbacks.shift()(a);
    });
  var b = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    for ("function" === typeof b && b(); loadIframeAPICallbacks.length; )
      loadIframeAPICallbacks.shift()(null, window.YT);
  };
};
YouTubePlayer.prototype._createPlayer = function (a) {
  var b = this;
  if (!this.destroyed) {
    var c = this._opts;
    this._player = new this._api.Player(this._id, {
      width: c.width,
      height: c.height,
      videoId: a,
      host: c.host,
      playerVars: {
        autoplay: c.autoplay ? 1 : 0,
        mute: c.mute ? 1 : 0,
        hl: null != c.captions && !1 !== c.captions ? c.captions : void 0,
        cc_lang_pref:
          null != c.captions && !1 !== c.captions ? c.captions : void 0,
        controls: c.controls ? 2 : 0,
        enablejsapi: 1,
        allowfullscreen: !0,
        iv_load_policy: c.annotations ? 1 : 3,
        modestbranding: c.modestBranding ? 1 : 0,
        origin: "*",
        rel: c.related ? 1 : 0,
        mode: "transparent",
        showinfo: 0,
        html5: 1,
        version: 3,
        playerapiid: "iframe_YTP_1624972482514",
      },
      events: {
        onReady: function () {
          return b._onReady(a);
        },
        onStateChange: function (a) {
          return b._onStateChange(a);
        },
        onPlaybackQualityChange: function (a) {
          return b._onPlaybackQualityChange(a);
        },
        onPlaybackRateChange: function (a) {
          return b._onPlaybackRateChange(a);
        },
        onError: function (a) {
          return b._onError(a);
        },
      },
    });
  }
};
YouTubePlayer.prototype._onReady = function (a) {
  this.destroyed ||
    ((this._ready = !0),
    this.load(this.videoId, this._autoplay, this._start),
    this._flushQueue());
};
YouTubePlayer.prototype._onStateChange = function (a) {
  if (!this.destroyed) {
    var b = YOUTUBE_STATES[a.data];
    if (b)
      ["paused", "buffering", "ended"].includes(b) && this._onTimeupdate(),
        this.emit(b),
        ["unstarted", "playing", "cued"].includes(b) && this._onTimeupdate();
    else throw Error("Unrecognized state change: " + a);
  }
};
YouTubePlayer.prototype._onPlaybackQualityChange = function (a) {
  this.destroyed || this.emit("playbackQualityChange", a.data);
};
YouTubePlayer.prototype._onPlaybackRateChange = function (a) {
  this.destroyed || this.emit("playbackRateChange", a.data);
};
YouTubePlayer.prototype._onError = function (a) {
  if (!this.destroyed && ((a = a.data), a !== YOUTUBE_ERROR.HTML5_ERROR)) {
    if (
      a === YOUTUBE_ERROR.UNPLAYABLE_1 ||
      a === YOUTUBE_ERROR.UNPLAYABLE_2 ||
      a === YOUTUBE_ERROR.NOT_FOUND ||
      a === YOUTUBE_ERROR.INVALID_PARAM
    )
      return this.emit("unplayable", this.videoId);
    this._destroy(Error("YouTube Player Error. Unknown error code: " + a));
  }
};
YouTubePlayer.prototype._startOptimizeDisplayEvent = function () {
  var a = this;
  this._resizeListener ||
    ((this._resizeListener = function () {
      return a._optimizeDisplayHandler("center, center");
    }),
    window.addEventListener("resize", this._resizeListener));
};
YouTubePlayer.prototype._onTimeupdate = function () {
  this.emit("timeupdate", this.getCurrentTime());
};
YouTubePlayer.prototype._startInterval = function () {
  var a = this;
  this._interval = setInterval(function () {
    return a._onTimeupdate();
  }, this._opts.timeupdateFrequency);
};
YouTubePlayer.prototype._stopInterval = function () {
  clearInterval(this._interval);
  this._interval = null;
};
