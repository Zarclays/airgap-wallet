import { AirGapAngularCoreModule } from '@zarclays/zgap-angular-core'
import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { IonicModule } from '@ionic/angular'
import { TranslateModule } from '@ngx-translate/core'

import { ComponentsModule } from '../../components/components.module'

import { ExchangeConfirmPage } from './exchange-confirm'

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ComponentsModule,
    TranslateModule,
    RouterModule.forChild([{ path: '', component: ExchangeConfirmPage }]),
    AirGapAngularCoreModule
  ],
  declarations: [ExchangeConfirmPage]
})
export class ExchangeConfirmPageModule {}
