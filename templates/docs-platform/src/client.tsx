import { mount, installHmr } from '@kvantjs/ryvax.js/client';
import { DemoApp } from './demo.js';

installHmr();

if (document.querySelector('#saas-root')) mount(<DemoApp />, '#saas-root');
