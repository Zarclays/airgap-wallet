import { AirGapAngularCoreModule } from '@zarclays/zgap-angular-core'
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { IonicModule } from '@ionic/angular'
import { TranslateModule } from '@ngx-translate/core'

import { ComponentsModule } from '../../components/components.module'

import { SubAccountAddPage } from './sub-account-add'

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ComponentsModule,
    TranslateModule,
    RouterModule.forChild([{ path: '', component: SubAccountAddPage }]),
    AirGapAngularCoreModule
  ],
  declarations: [SubAccountAddPage]
})
export class SubAccountAddPageModule {}
