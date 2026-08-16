"use client";

import { useEffect } from "react";
import { initBlitz } from "../lib/blitz-app";

/* Markup mirrors the browser-validated prototype 1:1 (same ids/classes);
   lib/blitz-app.js wires all behavior on mount. */
export default function BlitzApp() {
  useEffect(() => { initBlitz(); }, []);

  return (
    <>
      <a className="skiplink" href="#main">Skip to content</a>
      <header>
        <div className="logo">blitz</div>
        <div className="userchip" id="userChip"></div>
      </header>
      <nav className="tabs" aria-label="blitz sections">
        <div role="tablist" aria-label="blitz sections" style={{ display: "contents" }}>
          <button id="tabEdit" className="active" role="tab" aria-selected="true" aria-controls="viewEdit">Edit</button>
          <button id="tabExplore" role="tab" aria-selected="false" aria-controls="viewExplore">Explore</button>
        </div>
      </nav>
      <main id="main">
        {/* ================= EDIT VIEW ================= */}
        <div className="view active" id="viewEdit">
          <div className="intro">
            <h1>Steal any look. <b>Instantly.</b></h1>
            <p>Your photo or video &nbsp;+&nbsp; a reference you love &nbsp;=&nbsp; a .cube LUT for Resolve, Premiere, or Lightroom.</p>
            <p className="served" id="lutCounter" hidden><b id="lutCounterNum">0</b> LUTs served</p>
          </div>

          <p className="pnote">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="1" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>All processing happens in your browser — media never leaves your device</span>
          </p>

          <div className="drops">
            <div className="drop" id="dropTarget" role="button" tabIndex={0}
                 aria-label="Upload your photo or video — opens a file picker">
              <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden aria-hidden="true" tabIndex={-1} />
              <div className="plus" aria-hidden="true">+</div>
              <div className="label"><b>Your photo or video</b><small>click or drop an image or mp4</small></div>
            </div>
            <div className="drop" id="dropRef" role="button" tabIndex={0}
                 aria-label="Upload a reference image with the look you want — opens a file picker">
              <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden aria-hidden="true" tabIndex={-1} />
              <div className="plus" aria-hidden="true">+</div>
              <div className="label"><b>Reference look</b><small>a film still, a photo, even a video with a look you love</small></div>
            </div>
          </div>

          <div className="demo-row">
            <button id="btnDemo">Try with demo images</button>
          </div>

          <div className="workspace" id="workspace">
            <div className="viewer">
              <div className="compare-wrap" id="compareWrap">
                <canvas id="canvasAfter" role="img" aria-label="Your media with the color grade applied"></canvas>
                <canvas id="canvasBefore" role="img" aria-label="Your original media, ungraded"></canvas>
                <div className="divider" id="divider" role="slider" tabIndex={0}
                     aria-label="Before and after comparison — arrow keys move the divider"
                     aria-valuemin={0} aria-valuemax={100} aria-valuenow={50}></div>
              </div>
              <div className="transport" id="transport">
                <button id="btnPlay">Play</button>
                <input type="range" id="sSeek" min="0" max="1000" defaultValue="0" aria-label="Video position" />
                <div className="time" id="timeLabel" aria-live="off">0:00 / 0:00</div>
              </div>
              <div className="ab-labels"><span>Original</span><span>Graded</span></div>
            </div>

            <div className="panel">
              <h2 id="gradeLabel">Grade <span>· reference</span></h2>
              <div className="ctrl">
                <div className="row"><label htmlFor="sIntensity">Intensity</label><output id="oIntensity">80%</output></div>
                <input type="range" id="sIntensity" min="0" max="100" defaultValue="80" />
              </div>
              <h2>Trim</h2>
              <div className="ctrl">
                <div className="row"><label htmlFor="sExposure">Exposure</label><output id="oExposure">0</output></div>
                <input type="range" id="sExposure" min="-100" max="100" defaultValue="0" />
              </div>
              <div className="ctrl">
                <div className="row"><label htmlFor="sContrast">Contrast</label><output id="oContrast">0</output></div>
                <input type="range" id="sContrast" min="-100" max="100" defaultValue="0" />
              </div>
              <div className="ctrl">
                <div className="row"><label htmlFor="sSaturation">Saturation</label><output id="oSaturation">0</output></div>
                <input type="range" id="sSaturation" min="-100" max="100" defaultValue="0" />
              </div>
              <div className="ctrl">
                <div className="row"><label htmlFor="sTemperature">Temperature</label><output id="oTemperature">0</output></div>
                <input type="range" id="sTemperature" min="-100" max="100" defaultValue="0" />
              </div>
              <div className="ctrl">
                <div className="row"><label htmlFor="sTint">Tint</label><output id="oTint">0</output></div>
                <input type="range" id="sTint" min="-100" max="100" defaultValue="0" />
              </div>
              <button id="btnReset">Reset</button>
              <h2>Export</h2>
              <div className="exports">
                <input type="text" id="lutName" defaultValue="blitz-look-01" spellCheck="false" aria-label="File name for your exported LUT" />
                <button className="primary" id="btnLut">Download .cube LUT</button>
                <button id="btnImage">Download graded image</button>
                <button id="btnPublish">Publish to community</button>
              </div>
              <div className="hint" id="exportHint">Works in DaVinci Resolve, Premiere Pro (Lumetri), Final Cut, Photoshop &amp; Lightroom Classic.</div>

              <div className="adslot rail">
                <div className="adlabel">Ad space</div>
                <div className="adbody"><a href="mailto:abel.manoah@gmail.com?subject=Advertising%20on%20blitzluts.com%20-%20300x250">Contact us for advertising opportunities</a><span>300 × 250</span></div>
              </div>
            </div>
          </div>

          <div className="adslot banner">
            <div className="adlabel">Ad space</div>
            <div className="adbody"><a href="mailto:abel.manoah@gmail.com?subject=Advertising%20on%20blitzluts.com%20-%20728x90">Contact us for advertising opportunities</a><span>728 × 90</span></div>
          </div>
        </div>

        {/* ================= EXPLORE VIEW ================= */}
        <div className="view" id="viewExplore">
          <div className="explore-head">
            <h2>Community looks — rendered on <b>your</b> image.</h2>
            <p id="exploreSub">Every thumbnail below is your shot, graded live in your browser. <u id="exploreUpload">Change image</u></p>
          </div>
          <div className="grid" id="lookGrid"></div>
        </div>

      </main>
      <footer className="footnote">
        All processing happens in your browser — media never leaves your device<br />
        blitz · reference grading → LUT playground → creator community<br />
        <a href="/privacy">Privacy Policy</a> · <a href="mailto:abel.manoah@gmail.com">Contact</a> · <button type="button" id="feedbackLink" className="linklike">Give feedback</button>
      </footer>
      <div className="toast" id="toast" role="status" aria-live="polite"></div>

      <div className="authwall-modal" id="publishModal" role="dialog" aria-modal="true" aria-labelledby="publishTitle">
        <div className="authcard publishcard">
          <h2 id="publishTitle" className="authtitle">Publish your look</h2>
          <p>It appears in Explore, previewed on everyone&apos;s own images.</p>
          <div className="publish-fields">
            <label htmlFor="pubName">Name</label>
            <input type="text" id="pubName" maxLength={60} placeholder="Moody Coastal Wedding" />
            <label htmlFor="pubDesc">Description</label>
            <textarea id="pubDesc" rows={3} maxLength={400}
                      placeholder="What kind of footage is it for, and what does it do? Two sentences is plenty."></textarea>
            <label htmlFor="pubTags">Tags <span>comma separated</span></label>
            <input type="text" id="pubTags" placeholder="wedding, moody, cool" />
          </div>
          <div className="publish-actions">
            <button className="primary" id="pubSubmit">Publish</button>
            <button id="pubCancel">Cancel</button>
          </div>
          <div className="note" id="pubNote">Published looks are free for anyone to use and remix.</div>
        </div>
      </div>

      <div className="feedback-card" id="feedbackCard" role="dialog" aria-labelledby="feedbackTitle" hidden>
        <button className="feedback-close" id="feedbackClose" aria-label="Dismiss feedback request">×</button>
        <p id="feedbackTitle">How are you enjoying blitz?</p>
        <div className="stars" role="radiogroup" aria-label="Rate blitz from 1 to 5 stars" id="starRow">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className="star" data-star={n} role="radio" aria-checked="false"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}>★</button>
          ))}
        </div>
        <div className="feedback-more" id="feedbackMore" hidden>
          <input type="text" id="fbName" placeholder="Name (optional)" aria-label="Your name (optional)" autoComplete="name" />
          <input type="email" id="fbEmail" placeholder="Email (optional)" aria-label="Your email (optional)" autoComplete="email" />
          <textarea id="fbMessage" rows={3} placeholder="Anything we should know? (optional)" aria-label="Your feedback (optional)"></textarea>
          <button className="primary" id="fbSubmit">Send feedback</button>
        </div>
      </div>

      <div className="authwall-modal" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <div className="authcard">
          <div className="biglogo" aria-hidden="true">blitz</div>
          <h2 id="authTitle" className="authtitle">Join the blitz community.</h2>
          <p id="authReason">Sign in to publish looks, follow creators, and download community LUTs.</p>
          <div className="providers">
            <button data-provider="Google">Continue with Google</button>
            <button data-provider="Meta">Continue with Meta</button>
            <button data-provider="X">Continue with X</button>
            <button data-provider="LinkedIn">Continue with LinkedIn</button>
          </div>
          <button className="close" id="authClose">Not now</button>
          <div className="note" id="authNote">Free forever for browsing and grading.</div>
        </div>
      </div>

      <noscript>
        <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 24px", fontSize: 14, lineHeight: 1.8 }}>
          <h2>blitz — free online color grading and LUT generator</h2>
          <p>
            blitz lets you copy the color grade of any reference image onto your own photo or video, entirely in your
            browser. Upload your shot, add a film still or photo whose look you love, fine-tune the match, and export a
            free .cube LUT that works in DaVinci Resolve, Premiere Pro (Lumetri), Final Cut Pro, Photoshop and Lightroom
            Classic. Browse community looks like Teal &amp; Orange, Print Film 2383, Golden Hour and Noir — each
            previewed live on your own image. blitz requires JavaScript to run; please enable it to use the tool.
          </p>
        </div>
      </noscript>
    </>
  );
}
