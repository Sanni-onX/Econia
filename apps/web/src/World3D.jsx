import React, { useEffect, useRef, useState } from "react";
import { createWorldScene } from "./world3d-scene.mjs";
import { worldDistricts } from "./world3d-layout.mjs";
import "./world3d.css";

export default function World3D(props) {
  const host = useRef(null),
    scene = useRef(null),
    latest = useRef(props);
  const [status, setStatus] = useState("loading"),
    [hover, setHover] = useState(null);
  latest.current = props;
  useEffect(() => {
    let alive = true;
    try {
      scene.current = createWorldScene(host.current, {
        select: (id) => latest.current.onSelect(id),
        hover: (info) => alive && setHover(info),
        ready: () => alive && setStatus("ready"),
        unavailable: () => alive && setStatus("unavailable"),
      });
      scene.current.update(latest.current);
    } catch {
      setStatus("unavailable");
    }
    return () => {
      alive = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.update(props);
  }, [props.w, props.selected, props.fresh, props.layer, props.active]);
  useEffect(() => {
    scene.current?.command(props.camera, props.selected);
  }, [props.camera]);
  const { w, selected, onSelect, onDistrict, Avatar, layer } = props;
  const people = w.entities
    .filter(
      (e) =>
        e.type === "PERSON" &&
        (e.id === "person_199" ||
          (props.immersive && e.id === "person_042") ||
          e.id === selected ||
          parseInt(e.id.split("_")[1]) % 10 === 0),
    )
    .slice(0, 9);
  return (
    <div className="world-3d" data-renderer-state={status}>
      <div className="world-3d-canvas" ref={host} />
      {status === "loading" && (
        <div className="world-3d-loading">
          <span>◈</span>Opening the streets of Econia…
        </div>
      )}
      {status === "unavailable" && (
        <div className="world-3d-unavailable">
          <strong>The 3D view needs WebGL 2.</strong>
          <p>
            You can still explore every resident and business with the
            accessible city list.
          </p>
        </div>
      )}
      <div className="world-3d-labels" aria-label="City places and residents">
        {worldDistricts.map((d) => (
          <button
            key={d.id}
            data-world-anchor={`district:${d.id}`}
            className="world-district-label"
            onClick={() => onDistrict(d.id)}
            style={{ "--district-color": d.color }}
          >
            <i />
            <span>
              {props.districtLabels?.[d.id]?.label || d.label}
              <small>
                {props.districtLabels?.[d.id]?.subtitle || d.subtitle}
              </small>
            </span>
            <b>↗</b>
          </button>
        ))}
        {w.entities
          .filter(
            (e) =>
              e.type === "BUSINESS" &&
              (!props.immersive || e.agentId === selected),
          )
          .map((e) => (
            <button
              key={e.id}
              data-world-anchor={e.id}
              data-anchor-kind="place"
              className={
                "world-place-marker " + (selected === e.id ? "is-selected" : "")
              }
              aria-label={`Step inside ${e.name}`}
              onClick={() => onSelect(e.id)}
            >
              <span
                className={
                  "place-marker-icon industry-" + e.industry.toLowerCase()
                }
              >
                {e.industry === "FOOD"
                  ? "♨"
                  : e.industry === "FARMING"
                    ? "♧"
                    : e.industry === "MILLING"
                      ? "✣"
                      : "⚓"}
              </span>
              <span className="place-marker-name">{e.name}</span>
            </button>
          ))}
        {layer !== "Places" &&
          people.map((e) => (
            <button
              key={e.id}
              data-world-anchor={e.id}
              data-anchor-kind="person"
              className={
                "world-resident-marker " +
                (selected === e.id ? "is-selected" : "")
              }
              aria-label={`Meet ${e.name}`}
              onClick={() => onSelect(e.id)}
            >
              <Avatar entity={e} size={29} />
              {(e.id === "person_199" || selected === e.id) && (
                <span>
                  {e.name.split(" ")[0]}
                  <b>↗</b>
                </span>
              )}
            </button>
          ))}
      </div>
      {hover && (
        <div
          className="world-object-tooltip"
          style={{ left: hover.x, top: hover.y }}
        >
          <small>{hover.role}</small>
          <strong>{hover.name}</strong>
          <span>Step into their story ↗</span>
        </div>
      )}
      <div className="world-3d-credit">
        <span>ECONIA IN 3D</span> Original Econia models · scenery by{" "}
        <a href="https://kenney.nl" target="_blank" rel="noreferrer">
          Kenney
        </a>
      </div>
    </div>
  );
}
