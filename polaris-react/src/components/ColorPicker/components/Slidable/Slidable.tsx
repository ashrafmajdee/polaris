import React, {PureComponent} from 'react';

import {isServer} from '../../../../utilities/target';
// eslint-disable-next-line import/no-deprecated
import {EventListener} from '../../../EventListener';
import styles from '../../ColorPicker.module.css';

interface Position {
  x: number;
  y: number;
}

interface State {
  dragging: boolean;
  window?: Window | null;
}

export interface SlidableProps {
  draggerX?: number;
  draggerY?: number;
  onChange(position: Position): void;
  onDraggerHeight?(height: number): void;
}

let isDragging = false;

// Required to solve a bug causing the underlying page/container to scroll
// while trying to drag the ColorPicker controls.
// This must be called as soon as possible to properly prevent the event.
// `passive: false` must also be set, as it seems webkit has changed the "default" behaviour
// https://bugs.webkit.org/show_bug.cgi?id=182521
if (!isServer) {
  window.addEventListener(
    'touchmove',
    (event) => {
      if (!isDragging) {
        return;
      }

      event.preventDefault();
    },
    {passive: false},
  );
}

export class Slidable extends PureComponent<SlidableProps, State> {
  state: State = {
    dragging: false,
  };

  private node: HTMLElement | null = null;
  private draggerNode: HTMLElement | null = null;
  private observer?: ResizeObserver;

  componentWillUnmount() {
    this.observer?.disconnect();
  }

  componentDidMount() {
    if (!this.node) {
      return;
    }

    this.observer = new ResizeObserver(() => {
      /**
       * This is a workaround to enable event listeners to be
       * re-attached when moving from one document to another
       * when using a React portal across iframes.
       * Using a resize observer works because when the clientWidth
       * will go from 0 to the real width after the node
       * gets rendered in its new place.
       */
      const {window} = this.state;
      if (window !== this.node?.ownerDocument.defaultView) {
        this.setState({window: this.node?.ownerDocument.defaultView});
      }
      this.handleResize();
    });

    this.observer.observe(this.node);

    this.handleResize();
  }

  render() {
    const {dragging, window} = this.state;
    const {draggerX = 0, draggerY = 0} = this.props;

    const draggerPositioning = {
      transform: `translate3d(${draggerX}px, ${draggerY}px, 0)`,
    };

    const moveListener = dragging ? (
      <EventListener
        event="mousemove"
        handler={this.handleMove}
        passive={false}
        window={window}
      />
    ) : null;

    const touchMoveListener = dragging ? (
      <EventListener
        event="touchmove"
        handler={this.handleMove}
        passive={false}
        window={window}
      />
    ) : null;

    const endDragListener = dragging ? (
      <EventListener
        event="mouseup"
        handler={this.handleDragEnd}
        window={window}
      />
    ) : null;

    const touchEndListener = dragging ? (
      <EventListener
        event="touchend"
        handler={this.handleDragEnd}
        window={window}
      />
    ) : null;

    const touchCancelListener = dragging ? (
      <EventListener
        event="touchcancel"
        handler={this.handleDragEnd}
        window={window}
      />
    ) : null;

    return (
      <div
        ref={this.setNode}
        className={styles.Slidable}
        onMouseDown={this.startDrag}
        onTouchStart={this.startDrag}
      >
        {endDragListener}
        {moveListener}
        {touchMoveListener}
        {touchEndListener}
        {touchCancelListener}
        <div
          style={draggerPositioning}
          className={styles.Dragger}
          ref={this.setDraggerNode}
        />
      </div>
    );
  }

  private handleResize() {
    const {onDraggerHeight} = this.props;
    if (!onDraggerHeight) {
      return;
    }

    const {draggerNode} = this;

    if (!draggerNode) {
      return;
    }

    onDraggerHeight(draggerNode.clientWidth);

    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        onDraggerHeight(draggerNode.clientWidth);
      }, 0);
    }
  }

  private setDraggerNode = (node: HTMLElement | null) => {
    this.draggerNode = node;
  };

  private setNode = (node: HTMLElement | null) => {
    this.node = node;
  };

  private startDrag = (
    event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    if (isMouseDownEvent(event)) {
      this.handleDraggerMove(event.clientX, event.clientY);
    }

    isDragging = true;
    this.setState({dragging: true});
  };

  private handleDragEnd = () => {
    isDragging = false;
    this.setState({dragging: false});
  };

  private handleMove = (event: MouseEvent | TouchEvent) => {
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (event.cancelable) {
      event.preventDefault();
    }

    if (isMouseMoveEvent(event)) {
      this.handleDraggerMove(event.clientX, event.clientY);
      return;
    }

    this.handleDraggerMove(event.touches[0].clientX, event.touches[0].clientY);
  };

  private handleDraggerMove = (x: number, y: number) => {
    if (this.node == null) {
      return;
    }

    const {onChange} = this.props;

    const rect = this.node.getBoundingClientRect();
    const offsetX = x - rect.left;
    const offsetY = y - rect.top;
    onChange({x: offsetX, y: offsetY});
  };
}

function isMouseMoveEvent(event: Event): event is MouseEvent {
  return event.type === 'mousemove';
}

function isMouseDownEvent(
  event: React.MouseEvent | React.TouchEvent,
): event is React.MouseEvent {
  return event.type === 'mousedown';
}
