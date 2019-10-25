/*!
 * Copyright 2018 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as _ from 'lodash';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as admin from '../../lib/index';
import { projectId } from './setup';

const APP_NAMESPACE_PREFIX = 'com.adminsdkintegrationtest.a';
const APP_NAMESPACE_SUFFIX_LENGTH = 15;

const APP_DISPLAY_NAME_PREFIX = 'Created By Firebase AdminSDK Nodejs Integration Testing ';
const PROJECT_DISPLAY_NAME_PREFIX = 'Nodejs AdminSDK Testing ';
const APP_DISPLAY_NAME_SUFFIX_LENGTH = 15;
const PROJECT_DISPLAY_NAME_SUFFIX_LENGTH = 6;

const SHA_256_HASH = 'aaaaccccaaaaccccaaaaccccaaaaccccaaaaccccaaaaccccaaaaccccaaaacccc';

const expect = chai.expect;

chai.should();
chai.use(chaiAsPromised);

describe('admin.projectManagement', () => {

  let androidApp: admin.projectManagement.AndroidApp;
  let iosApp: admin.projectManagement.IosApp;

  before(() => {
    const androidPromise = ensureAndroidApp()
      .then((app) => {
        androidApp = app;
        return deleteAllShaCertificates(androidApp);
      });
    const iosPromise = ensureIosApp().then((app) => {
      iosApp = app;
    });

    return Promise.all([androidPromise, iosPromise]);
  });

  describe('iterateAndroidApps()', () => {
    it('successfully iterates Android apps', async () => {
      for await (const apps of admin.projectManagement().iterateAndroidApps()) {
        const metadatas: any[] = await Promise.all(apps.map((app) => app.getMetadata()));
        expect(metadatas.length).to.be.at.least(1);
        const metadataOwnedByTest: any =
          metadatas.find((metadata) => isIntegrationTestApp(metadata.packageName));
        expect(metadataOwnedByTest).to.exist;
        expect(metadataOwnedByTest.appId).to.equal(androidApp.appId);
      }
    });
  });

  describe('setDisplayName()', () => {
    it('successfully set project\'s display name', () => {
      const newDisplayName = generateUniqueProjectDisplayName();
      // TODO(caot): verify that project name has been renamed successfully after adding the ability
      //     to get project metadata.
      return admin.projectManagement().setDisplayName(newDisplayName)
        .should.eventually.be.fulfilled;
    });
  });

  describe('listAppMetadata()', () => {
    it('successfully lists metadata of all apps', () => {
      return admin.projectManagement().listAppMetadata()
        .then((metadatas) => {
          expect(metadatas.length).to.be.at.least(2);
          const testAppMetadatas = metadatas.filter((metadata) =>
            isIntegrationTestAppDisplayName(metadata.displayName) &&
            (metadata.appId === androidApp.appId || metadata.appId === iosApp.appId));
          expect(testAppMetadatas).to.have.length(2);
        });
    });
  });

  describe('androidApp.getMetadata()', () => {
    it('successfully sets Android app\'s display name', () => {
      return androidApp.getMetadata().then((appMetadata) => {
        expect(appMetadata.displayName).to.include(APP_DISPLAY_NAME_PREFIX);
        expect(appMetadata.projectId).to.equal(projectId);
        expect(appMetadata.packageName).to.include(APP_NAMESPACE_PREFIX);
      });
    });
  });

  describe('iosApp.getMetadata()', () => {
    it('successfully sets iOS app\'s display name', () => {
      return iosApp.getMetadata().then((appMetadata) => {
        expect(appMetadata.displayName).to.include(APP_DISPLAY_NAME_PREFIX);
        expect(appMetadata.projectId).to.equal(projectId);
        expect(appMetadata.bundleId).to.include(APP_NAMESPACE_PREFIX);
      });
    });
  });

  describe('androidApp.setDisplayName()', () => {
    it('successfully sets Android app\'s display name', () => {
      const newDisplayName = generateUniqueAppDisplayName();
      return androidApp.setDisplayName(newDisplayName)
        .then(() => androidApp.getMetadata())
        .then((appMetadata) => {
          expect(appMetadata.displayName).to.equal(newDisplayName);
        });
    });
  });

  describe('iosApp.setDisplayName()', () => {
    it('successfully sets iOS app\'s display name', () => {
      const newDisplayName = generateUniqueAppDisplayName();
      return iosApp.setDisplayName(newDisplayName)
        .then(() => iosApp.getMetadata())
        .then((appMetadata) => {
          expect(appMetadata.displayName).to.equal(newDisplayName);
        });
    });
  });

  describe('androidApp.{get,add,delete}ShaCertificate()', () => {
    it('successfully gets, adds, and deletes SHA certificates', () => {
      // Steps:
      //   1. Check that this app has no certs.
      //   2. Add a cert to this app.
      //   3. Check that the cert was added successfully.
      //   4. Delete the cert we just created.
      //   5. Check that this app has no certs.
      return androidApp.getShaCertificates()
        .then((certs) => {
          expect(certs.length).to.equal(0);

          const shaCertificate = admin.projectManagement().shaCertificate(SHA_256_HASH);
          return androidApp.addShaCertificate(shaCertificate);
        })
        .then(() => androidApp.getShaCertificates())
        .then((certs) => {
          expect(certs.length).to.equal(1);
          expect(certs[0].shaHash).to.equal(SHA_256_HASH);
          expect(certs[0].certType).to.equal('sha256');
          expect(certs[0].resourceName).to.not.be.empty;

          return androidApp.deleteShaCertificate(certs[0]);
        })
        .then(() => androidApp.getShaCertificates())
        .then((certs) => {
          expect(certs.length).to.equal(0);
        });
    });

    it('add a cert and then remove it fails due to missing resourceName',
      () => {
        const shaCertificate =
          admin.projectManagement().shaCertificate(SHA_256_HASH);
        return androidApp.addShaCertificate(shaCertificate)
          .then(() => androidApp.deleteShaCertificate(shaCertificate))
          .should.eventually.be
          .rejectedWith(
            'Specified certificate does not include a resourceName')
          .with.property('code', 'project-management/invalid-argument');
      });
  });

  describe('androidApp.getConfig()', () => {
    it('successfully gets the Android app\'s config', () => {
      return androidApp.getConfig().then((config) => {
        expect(config).is.not.empty;
        expect(config).includes(androidApp.appId);
      });
    });
  });

  describe('iosApp.getConfig()', () => {
    it('successfully gets the iOS app\'s config', () => {
      return iosApp.getConfig().then((config) => {
        expect(config).is.not.empty;
        expect(config).includes(iosApp.appId);
      });
    });
  });
});

/**
 * Ensures that an Android app owned by these integration tests exist. If not one will be created.
 *
 * @return {Promise<AndroidApp>} Android app owned by these integration tests.
 */
async function ensureAndroidApp(): Promise<admin.projectManagement.AndroidApp> {
  let retApp;

  for await (const apps of admin.projectManagement().iterateAndroidApps()) {
    const metadatas: any[] = await Promise.all(apps.map((app) => app.getMetadata()));
    const metadataOwnedByTest =
      metadatas.find((metadata) => isIntegrationTestApp(metadata.packageName));
    if (metadataOwnedByTest) {
      retApp = await admin.projectManagement().androidApp(metadataOwnedByTest.appId);
      break;
    }

    // If no Android app owned by these integration tests was found, then create one.
    retApp = await admin.projectManagement()
      .createAndroidApp(generateUniqueAppNamespace(), generateUniqueAppDisplayName());

    break;
  }

  return retApp;
}

/**
 * Ensures that an iOS app owned by these integration tests exist. If not one will be created.
 *
 * @return {Promise<IosApp>} iOS app owned by these integration tests.
 */
async function ensureIosApp(): Promise<admin.projectManagement.IosApp> {
  let retApp;

  for await (const apps of admin.projectManagement().iterateIosApps()) {
    const metadatas = await Promise.all(apps.map((app) => app.getMetadata()));

    const metadataOwnedByTest =
      metadatas.find((metadata) => isIntegrationTestApp(metadata.bundleId));
    if (metadataOwnedByTest) {
      retApp = await admin.projectManagement().iosApp(metadataOwnedByTest.appId);
      break;
    }

    // If no iOS app owned by these integration tests was found, then create one.
    retApp = await admin.projectManagement()
      .createIosApp(generateUniqueAppNamespace(), generateUniqueAppDisplayName());

    break;
  }

  return retApp;
}

/**
 * Deletes all SHA certificates from the specified Android app.
 */
function deleteAllShaCertificates(androidApp: admin.projectManagement.AndroidApp): Promise<void> {
  return androidApp.getShaCertificates()
    .then((shaCertificates: admin.projectManagement.ShaCertificate[]) => {
      return Promise.all(shaCertificates.map((cert) => androidApp.deleteShaCertificate(cert)));
    })
    .then(() => null);
}

/**
 * @return {string} Dot-separated string that can be used as a unique package name or bundle ID.
 */
function generateUniqueAppNamespace() {
  return APP_NAMESPACE_PREFIX + generateRandomString(APP_NAMESPACE_SUFFIX_LENGTH);
}

/**
 * @return {string} Dot-separated string that can be used as a unique app display name.
 */
function generateUniqueAppDisplayName() {
  return APP_DISPLAY_NAME_PREFIX + generateRandomString(APP_DISPLAY_NAME_SUFFIX_LENGTH);
}

/**
 * @return {string} string that can be used as a unique project display name.
 */
function generateUniqueProjectDisplayName() {
  return PROJECT_DISPLAY_NAME_PREFIX + generateRandomString(PROJECT_DISPLAY_NAME_SUFFIX_LENGTH);
}

/**
 * @return {boolean} True if the specified appNamespace belongs to these integration tests.
 */
function isIntegrationTestApp(appNamespace: string): boolean {
  return appNamespace && appNamespace.startsWith(APP_NAMESPACE_PREFIX);
}

/**
 * @return {boolean} True if the specified appDisplayName belongs to these integration tests.
 */
function isIntegrationTestAppDisplayName(appDisplayName: string): boolean {
  return appDisplayName && appDisplayName.startsWith(APP_DISPLAY_NAME_PREFIX);
}

/**
 * @return {string} A randomly generated alphanumeric string, of the specified length.
 */
function generateRandomString(stringLength: number): string {
  return _.times(stringLength, () => _.random(35).toString(36)).join('');
}
